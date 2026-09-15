package villages.gateway

import villages.application.EventFeed
import villages.application.FoundHouseService
import villages.application.HouseRow
import villages.application.HousesByCell
import villages.application.Start
import villages.application.HousesByPlayer
import villages.application.PlayerTokens
import villages.application.Provenance
import villages.application.StoredEvent
import villages.application.WorldClock
import villages.application.WriteConflict
import villages.domain.Banner
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.WorldTime
import villages.protocol.BannerSpec
import villages.protocol.Batch
import villages.protocol.Cell
import villages.protocol.Charge
import villages.protocol.ClientFrame
import villages.protocol.Command
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.Delta
import villages.protocol.Division
import villages.protocol.ErrorFrame
import villages.protocol.EventFrame
import villages.protocol.FoundHousePayload
import villages.protocol.Hello
import villages.protocol.HouseAppeared
import villages.protocol.HouseChanged
import villages.protocol.HouseView
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.Ping
import villages.protocol.Point
import villages.protocol.Pong
import villages.protocol.ProtocolJson
import villages.protocol.Rate
import villages.protocol.Resync
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.SubscribeCells
import villages.protocol.TakenOver
import villages.protocol.Tincture
import villages.protocol.UnsubscribeCells
import villages.protocol.ViewTime
import villages.protocol.WatchEvents
import villages.protocol.Welcome
import villages.protocol.WorldNow
import villages.protocol.YourHouse
import villages.protocol.coarsestZoom
import java.time.Clock
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** What the gateway needs to send a frame to a connection. The transport is Spring's; this is not. */
fun interface Outbound {
    fun send(frame: ServerFrame)
}

/** Runs something a little later. Injected, so a test decides when later is. */
fun interface Later {
    fun schedule(delayMs: Long, action: Runnable)
}

/** Later on one daemon thread, which is all the coalescing of a whole process needs. */
class ScheduledLater : Later, AutoCloseable {
    private val thread = Executors.newSingleThreadScheduledExecutor { runnable ->
        Thread(runnable, "gateway-coalesce").apply { isDaemon = true }
    }

    override fun schedule(delayMs: Long, action: Runnable) {
        thread.schedule(action, delayMs, TimeUnit.MILLISECONDS)
    }

    override fun close() {
        thread.shutdownNow()
    }
}

/** Cells one connection may hold at once. A screen is a dozen or so; this is room to look ahead, not to hoard. */
const val MOST_CELLS = 64

/** Houses one snapshot carries. Past this the cell is a crowd, and the snapshot says how big a one. */
const val MOST_IN_A_CELL = 200

/** How long deltas gather before one batch goes out, so a busy cell is one frame a quarter second. */
const val COALESCE_MS = 250L

/** Deltas a connection may have waiting. Past this it is told to ask again rather than be buried. */
const val MOST_WAITING = 500

/**
 * The edge, without the transport: one instance per process, one `Connection` per socket. It speaks the
 * protocol, translates it to the application's terms and back, serves a cell's snapshot from the read
 * model on subscribing, and fans every change out to whoever holds a cell containing it. Nothing in here
 * knows what a WebSocket is, so it is tested by calling it.
 *
 * The fan-out is decision 0026 on the write side: a changed house has one deepest cell, and every
 * connection that should hear of it holds one of that cell's prefixes, from the zoom the house's
 * significance is first worth drawing at down to the deepest. That is at most eleven lookups a change.
 */
class Gateway(
    private val tokens: PlayerTokens,
    private val foundHouse: FoundHouseService,
    events: EventFeed,
    private val houses: HousesByCell,
    private val theirHouses: HousesByPlayer,
    private val clock: Clock,
    private val world: WorldClock,
    private val later: Later = ScheduledLater(),
) : AutoCloseable {
    private val watching = ConcurrentHashMap<Connection, Unit>()

    /** Which connections hold each cell: the whole of the fan-out index. */
    private val holding = ConcurrentHashMap<String, MutableSet<Connection>>()

    /**
     * The one session a player has. A player plays from one place: a second hello takes the player over
     * and the older connection is stood down. One connection a player, not a set. See decision 0028.
     */
    private val sessions = ConcurrentHashMap<PlayerId, Connection>()

    // From now: the debug panel watches the world happening, and would not thank us for the whole
    // chronicle replayed at it on every connect.
    private val feed: AutoCloseable = events.subscribe(Start.FROM_NOW) { stored -> fanOutEvent(stored) }
    private val changes: AutoCloseable = houses.watch { row -> fanOutChange(row) }

    fun connect(out: Outbound): Connection = Connection(out)

    private fun fanOutEvent(stored: StoredEvent) {
        val frame = stored.toFrame()
        for (connection in watching.keys) {
            connection.out.send(frame)
        }
    }

    private fun fanOutChange(row: HouseRow) {
        val deepest = Cell.of(row.seat.lat, row.seat.lon)
        val view = row.toView(deepest)

        // Your own house reaches you wherever you are looking, not only when you hold its cell.
        sessions[row.player]?.out?.send(YourHouse(view))

        val delta: Delta = if (row.version == 1L) HouseAppeared(view) else HouseChanged(view)
        for (zoom in coarsestZoom(row.significance.value)..Cell.MAX_ZOOM) {
            val holders = holding[deepest.at(zoom).quadkey] ?: continue
            for (connection in holders) {
                if (connection.sees(row)) {
                    connection.enqueue(delta)
                }
            }
        }
    }

    override fun close() {
        feed.close()
        changes.close()
        (later as? AutoCloseable)?.close()
    }

    inner class Connection(internal val out: Outbound) {
        var player: PlayerId? = null
            private set

        private val lock = Any()
        private val cells = LinkedHashSet<String>()
        private val waiting = ArrayDeque<Delta>()
        private var flushPlanned = false

        /** The world-day this connection is looking at, or null for live: the scrubber's position. */
        @Volatile
        private var viewingAt: WorldTime? = null

        /** Set when this session is over, by a takeover or by the socket going away. It then does nothing. */
        @Volatile
        private var finished = false

        private fun viewing(): WorldTime = viewingAt ?: world.today()

        /** Whether a change is on this connection's day. Live sees everything; the past sees what existed then. */
        internal fun sees(row: HouseRow): Boolean = viewingAt?.let { row.existsAt(it) } ?: true

        /** The cells this connection holds, for the tests and the panel. */
        fun cells(): Set<String> = synchronized(lock) { cells.toSet() }

        fun receive(text: String) {
            if (finished) {
                return
            }
            val frame = try {
                ProtocolJson.decodeClient(text)
            } catch (unreadable: Exception) {
                out.send(ErrorFrame("unreadable", "not a frame this gateway speaks: ${unreadable.message}"))
                return
            }
            handle(frame)
        }

        private fun handle(frame: ClientFrame) {
            when (frame) {
                is Hello -> hello(frame)
                is Ping -> out.send(Pong(frame.t0, clock.millis()))
                is WatchEvents -> if (frame.on) watching[this] = Unit else watching.remove(this)
                is Command -> command(frame)
                is SubscribeCells -> subscribe(frame.cells)
                is UnsubscribeCells -> unsubscribe(frame.cells)
                is ViewTime -> viewTime(frame.at)
            }
        }

        private fun hello(frame: Hello) {
            if (player != null) {
                out.send(ErrorFrame("alreadyIntroduced", "this session has already said who it is"))
                return
            }
            if (frame.protocolVersion != PROTOCOL_VERSION) {
                out.send(ErrorFrame("protocolVersion", "this gateway speaks version $PROTOCOL_VERSION"))
                return
            }
            val who = try {
                tokens.playerOf(frame.playerToken)
            } catch (bad: IllegalArgumentException) {
                out.send(ErrorFrame("playerToken", bad.message ?: "not a player token"))
                return
            }
            player = who

            // A player plays from one place. Whoever arrives last is the session; the one before is done.
            sessions.put(who, this)?.takeIf { it !== this }?.standDown()

            val today = world.today()
            out.send(
                Welcome(
                    serverTime = clock.millis(),
                    playerId = who.value.toString(),
                    world = WorldNow(today = today.day, earliest = (houses.earliest() ?: today).day),
                ),
            )
            out.send(YourHouse(theirHouses.ofPlayer(who)?.toView()))
        }

        /**
         * Ends this session without ending its socket: it holds no cells, hears nothing more and accepts
         * nothing more. The gateway does not close sockets - `Outbound` says frames and nothing else - so
         * the client is told and closes its own. One that does not is left holding something inert.
         */
        internal fun standDown() {
            if (finished) {
                return
            }
            finished = true
            letEverythingGo()
            out.send(TakenOver("another window took this player over"))
        }

        private fun command(frame: Command) {
            val who = player
            if (who == null) {
                out.send(CommandRejected(frame.commandId, "notIntroduced"))
                return
            }
            // The id becomes the causation of every event this command writes, so it has to be an
            // identity rather than whatever the client felt like sending. See decision record 0035.
            val commandId = runCatching { java.util.UUID.fromString(frame.commandId) }.getOrNull()
            if (commandId == null) {
                out.send(CommandRejected(frame.commandId, "malformed: a command id is a UUID"))
                return
            }

            try {
                when (val payload = frame.command) {
                    is FoundHousePayload -> foundHouse.found(
                        houseId = HouseId.of(who),
                        player = who,
                        name = HouseName.of(payload.name),
                        seat = Location(payload.seat.lat, payload.seat.lon),
                        banner = payload.banner.toDomain(),
                        provenance = Provenance.startedBy(commandId),
                    )
                }
                out.send(CommandAccepted(frame.commandId))
            } catch (refused: HouseError) {
                out.send(CommandRejected(frame.commandId, refused.reasonCode()))
            } catch (@Suppress("SwallowedException") busy: WriteConflict) {
                // Not a refusal: the stream moved under us. Trying again may well be accepted.
                out.send(CommandRejected(frame.commandId, "conflict"))
            } catch (malformed: IllegalArgumentException) {
                out.send(CommandRejected(frame.commandId, "malformed: ${malformed.message}"))
            }
        }

        /**
         * Takes the cells not already held, refusing the lot if any is not a cell or if together they would
         * exceed the cap, and answers each new one with what it holds right now. A change fanned out between
         * the cell being registered and its snapshot being read can arrive as a delta first; the client
         * orders by version, so it does not matter.
         */
        private fun subscribe(asked: List<String>) {
            val notCells = asked.filterNot(::isCell)
            if (notCells.isNotEmpty()) {
                out.send(ErrorFrame("badCell", "not cells: ${notCells.joinToString()}"))
                return
            }
            val fresh: List<String> = synchronized(lock) {
                val new = asked.distinct().filter { it !in cells }
                if (cells.size + new.size > MOST_CELLS) {
                    out.send(ErrorFrame("tooManyCells", "a connection holds at most $MOST_CELLS cells; zoom in"))
                    return
                }
                cells += new
                new
            }
            for (cell in fresh) {
                holding.computeIfAbsent(cell) { ConcurrentHashMap.newKeySet() }.add(this)
                snapshot(cell)
            }
        }

        /** What the cell holds on the day this connection is looking at. */
        private fun snapshot(cell: String) {
            val contents = houses.inCell(cell, viewing(), MOST_IN_A_CELL)
            out.send(
                Snapshot(
                    cell = cell,
                    houses = contents.houses.map { it.toView() },
                    asOfVersion = contents.asOf,
                    omitted = contents.omitted,
                ),
            )
        }

        /**
         * Moves this connection's eye along the timeline. Every held cell is answered again as of that day, so
         * the map redraws the world as it was; from then on only changes that exist on that day are sent.
         */
        private fun viewTime(at: Long?) {
            if (at != null && at < 0) {
                out.send(ErrorFrame("badTime", "the world's calendar starts at day 0, not $at"))
                return
            }
            viewingAt = at?.let { WorldTime(it) }
            for (cell in cells()) {
                snapshot(cell)
            }
        }

        private fun unsubscribe(asked: List<String>) {
            synchronized(lock) { cells -= asked.toSet() }
            for (cell in asked) {
                holding[cell]?.remove(this)
            }
        }

        /**
         * Queues a delta for the next batch. A connection that cannot keep up is not allowed to grow a queue:
         * past the bound, what is waiting is dropped, the cells are let go, and the connection is told to ask
         * for them again - which it must, because asking for a cell already held is answered with nothing,
         * and the point of a resync is a fresh snapshot.
         */
        internal fun enqueue(delta: Delta) {
            var letGo: List<String>? = null
            var plan = false
            synchronized(lock) {
                if (waiting.size >= MOST_WAITING) {
                    waiting.clear()
                    letGo = cells.toList()
                    cells.clear()
                } else {
                    waiting.addLast(delta)
                    if (!flushPlanned) {
                        flushPlanned = true
                        plan = true
                    }
                }
            }
            letGo?.let { gone ->
                for (cell in gone) {
                    holding[cell]?.remove(this)
                }
                out.send(Resync(gone))
            }
            if (plan) {
                later.schedule(COALESCE_MS) { flush() }
            }
        }

        /** One batch, with a house that reached this connection through two of its cells sent once. */
        private fun flush() {
            val batch = synchronized(lock) {
                flushPlanned = false
                val distinct = waiting.distinctBy { it.house.id to it.house.version }
                waiting.clear()
                distinct
            }
            if (batch.isNotEmpty()) {
                out.send(Batch(batch))
            }
        }

        fun disconnected() {
            finished = true
            letEverythingGo()
            // Only if this is still the session: the loser of a takeover often closes afterwards, and
            // removing by key alone would evict the window that just won.
            player?.let { sessions.remove(it, this) }
        }

        private fun letEverythingGo() {
            watching.remove(this)
            val held = synchronized(lock) { cells.toList().also { cells.clear() } }
            for (cell in held) {
                holding[cell]?.remove(this)
            }
        }
    }
}

private fun isCell(candidate: String): Boolean = runCatching { Cell(candidate) }.isSuccess

private val Delta.house: HouseView
    get() = when (this) {
        is HouseAppeared -> house
        is HouseChanged -> house
    }

/** A domain refusal as the short code the protocol carries, which the interface turns into words. */
internal fun HouseError.reasonCode(): String = when (this) {
    HouseError.AlreadyFounded -> "alreadyFounded"
    is HouseError.InvalidName -> "invalidName"
    is HouseError.InvalidLocation -> "invalidLocation"
    is HouseError.InvalidBanner -> "invalidBanner"
    is HouseError.InvalidChoice -> "invalidChoice"
    HouseError.ChoicePending -> "choicePending"
    HouseError.NoChoicePending -> "noChoicePending"
    HouseError.NoSuchChoice -> "noSuchChoice"
    HouseError.NoSuchOption -> "noSuchOption"
}

internal fun StoredEvent.toFrame(): EventFrame = EventFrame(
    id = id,
    eventType = type,
    stream = stream,
    streamVersion = streamVersion,
    time = time.toEpochMilli(),
    correlationId = correlationId,
    causationId = causationId,
    data = ProtocolJson.tree(data),
)

/** A row of the read model as the map shows it. The cell on the wire is the house's deepest. */
internal fun HouseRow.toView(deepest: Cell = Cell.of(seat.lat, seat.lon)): HouseView = HouseView(
    id = id.value.toString(),
    name = name.value,
    cell = deepest.quadkey,
    seat = Point(seat.lat, seat.lon),
    banner = banner.toWire(),
    treasury = Rate(treasury.amount, treasury.ratePerSecond, treasury.asOf.toEpochMilli()),
    since = since.day,
    version = version,
)

/** The domain's heraldry, spelled for the interface. The two enums share their names on purpose. */
internal fun Banner.toWire(): BannerSpec = BannerSpec(
    field = Tincture.valueOf(field.name),
    division = Division.valueOf(division.name),
    second = second?.let { Tincture.valueOf(it.name) },
    charge = Charge.valueOf(charge.name),
    chargeTincture = Tincture.valueOf(chargeTincture.name),
)

/** The wire's heraldry, spelled for the interface, into the domain's. */
internal fun BannerSpec.toDomain(): Banner = Banner(
    field = field.toDomain(),
    division = when (division) {
        Division.PLAIN -> villages.domain.Division.PLAIN
        Division.PER_PALE -> villages.domain.Division.PER_PALE
        Division.PER_FESS -> villages.domain.Division.PER_FESS
        Division.QUARTERLY -> villages.domain.Division.QUARTERLY
    },
    second = second?.toDomain(),
    charge = when (charge) {
        Charge.TOWER -> villages.domain.Charge.TOWER
        Charge.STAG -> villages.domain.Charge.STAG
        Charge.STAR -> villages.domain.Charge.STAR
    },
    chargeTincture = chargeTincture.toDomain(),
)

internal fun Tincture.toDomain(): villages.domain.Tincture = villages.domain.Tincture.valueOf(name)
