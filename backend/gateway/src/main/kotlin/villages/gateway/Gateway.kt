package villages.gateway

import villages.application.Arrival
import villages.application.CharacterRow
import villages.application.ChoicesByPlayer
import villages.application.EventFeed
import villages.application.Faults
import villages.application.FoundHouseService
import villages.application.CharacterSpan
import villages.application.PlacedCharacter
import villages.application.CharactersByCell
import villages.application.HouseRow
import villages.application.HousesByCell
import villages.application.HousesByPlayer
import villages.application.KeyFigureService
import villages.application.KeyFiguresByHouse
import villages.application.PlayerTokens
import villages.application.Later
import villages.application.Sight
import villages.application.SightsByHouse
import villages.application.Stands
import villages.application.RecentEvents
import villages.application.ResourceService
import villages.application.TakeActionService
import villages.application.DialogueService
import villages.application.DialoguesByHouse
import villages.application.VisionService
import villages.application.WorldClock
import villages.application.WorldWipe
import villages.application.WriteConflict
import villages.domain.DomainError
import villages.domain.HouseId
import villages.domain.PlayerId
import villages.domain.Vision
import villages.domain.WorldTime
import villages.protocol.Batch
import villages.protocol.ClientFrame
import villages.protocol.Command
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.Delta
import villages.protocol.ErrorFrame
import villages.protocol.Hello
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.Ping
import villages.protocol.Pong
import villages.protocol.ProtocolJson
import villages.protocol.Resync
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.STAND_TILES
import villages.protocol.StandRecords
import villages.protocol.StandsFrame
import villages.protocol.standTilesUnder
import villages.protocol.SubscribeCells
import villages.protocol.TakenOver
import villages.protocol.UnsubscribeCells
import villages.protocol.ViewTime
import villages.protocol.Welcome
import villages.protocol.WorldNow
import villages.protocol.WorldWiped
import villages.protocol.YourSight
import java.time.Clock
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap

/** What the gateway needs to send a frame to a connection. The transport is Spring's; this is not. */
fun interface Outbound {
    fun send(frame: ServerFrame)
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
 * This is the core, which every mechanic shares: who a connection's player is and the takeover, the cells
 * held, the fan-out index, coalescing, the fog gate and a cell's snapshot. What a mechanic says and takes is
 * a [Part] of its own, and the core hands each its turn. See decision record 0075.
 *
 * The fan-out is decision 0026 on the write side: a changed house has one deepest cell, and every
 * connection that should hear of it holds one of that cell's prefixes, from the zoom the house's
 * significance is first worth drawing at down to the deepest. That is at most eleven lookups a change.
 *
 * Nothing reaches a connection that its house's fog of war holds back, a snapshot or a delta: `Fog` is
 * asked of everything before it goes. See decision record 0061. That includes the scenery's stands, which
 * a page is sent tile by tile under the cells it holds, only where they touch ground its house has
 * revealed. See decision record 0067.
 */
class Gateway(
    private val tokens: PlayerTokens,
    foundHouse: FoundHouseService,
    events: EventFeed,
    faults: Faults,
    private val houses: HousesByCell,
    theirHouses: HousesByPlayer,
    private val clock: Clock,
    private val world: WorldClock,
    arrival: Arrival,
    takeAction: TakeActionService,
    resources: ResourceService,
    choices: ChoicesByPlayer,
    recent: RecentEvents,
    emptyTheWorld: WorldWipe,
    keyFigures: KeyFigureService,
    figures: KeyFiguresByHouse,
    private val onTheMap: CharactersByCell,
    private val sights: SightsByHouse,
    visions: VisionService,
    dialogues: DialogueService,
    dialogueRows: DialoguesByHouse,
    private val stands: Stands = Stands { _, _, _ -> null },
    private val later: Later,
    instrumentsOpen: Boolean = true,
) : AutoCloseable {
    /** Which connections hold each cell: the whole of the fan-out index. */
    private val holding = CellIndex<Connection>()

    /**
     * The one session a player has. A player plays from one place: a second hello takes the player over
     * and the older connection is stood down. One connection a player, not a set. See decision 0028.
     */
    private val sessions = ConcurrentHashMap<PlayerId, Connection>()

    /** Every live connection, so that a wipe can tell all of them and not only the introduced ones. */
    private val live = ConcurrentHashMap.newKeySet<Connection>()

    /** What the parts may ask of the core. */
    private val core = object : Core {
        override fun sessionOf(player: PlayerId): Connection? = sessions[player]

        override fun holders(cell: String): Set<Connection>? = holding.holders(cell)

        override fun endEverySession(why: WorldWiped) {
            sessions.clear()
            for (connection in live) {
                connection.finish(why)
            }
        }
    }

    /**
     * What a house sees, said to a player arriving in its place among the parts. The sight itself is still the
     * core's, with the fog it gates.
     */
    private val sightGreeting = object : Part {
        override fun greet(connection: Connection, who: PlayerId) {
            connection.out.send(YourSight(sights.of(HouseId.of(who)).toView(), Vision.SURFACE_TENSION))
        }
    }

    /**
     * A part for each mechanic, in the order a player arriving is told things: the house, whom it holds, what it
     * sees, what it was told, what it is asked; and Adam's instruments, which one setting closes (0076). Made
     * after the index and the sessions, because a part watches its read models from the moment it is made.
     * See decision record 0075.
     */
    private val parts: List<Part> = listOf(
        HousesPart(core, houses, theirHouses),
        KeyFiguresPart(core, figures, onTheMap),
        sightGreeting,
        DialoguesPart(core, dialogues, dialogueRows),
        ChoicesPart(core, arrival, takeAction, choices),
        Instruments(instrumentsOpen, core, events, recent, emptyTheWorld, foundHouse, resources, keyFigures, visions, dialogues),
    )

    /** Every command the gateway takes, and every frame a part answers, each with the one part that handles it. */
    private val commands = Commands()
    private val frames = Frames()

    init {
        parts.forEach { it.register(commands, frames) }
    }

    /**
     * What a house sees reaches its player wherever they are looking, like the house does: the fog of war is
     * the player's own, and needs no cell. It also changes what the player may be sent, so every cell they
     * hold is answered again. See decision record 0061.
     */
    private val seen: AutoCloseable = sights.watch { change ->
        sessions[change.player]?.sightChanged(change.sight)
    }

    /**
     * Anything acting on its own that threw is told to every window, because the debug panel in each is where
     * it is seen, and a read model missing an event is otherwise only a map that is quietly wrong. The stack
     * is in the server's log; this is the one line of it. See decision records 0023 and 0029.
     */
    private val faulted: AutoCloseable = faults.watch { fault ->
        val told = ErrorFrame("fault", fault.describe())
        for (connection in live) {
            connection.out.send(told)
        }
    }

    fun connect(out: Outbound): Connection = Connection(out).also { live += it }

    /** How many cells somebody holds, for the tests that hold the index to letting go. */
    internal val cellsHeld: Int get() = holding.size

    /** The kinds of command something here takes, for the test that every kind has its one handler. */
    internal val commandKinds get() = commands.kinds

    /** The kinds of frame a part answers, for the test that every kind is answered once. */
    internal val frameKinds get() = frames.kinds

    override fun close() {
        parts.forEach(Part::close)
        seen.close()
        faulted.close()
    }

    inner class Connection(private val transport: Outbound) {
        /**
         * Every frame to this connection goes out through here, and nothing a send throws gets past it. The
         * fan-outs send from inside the read models' watchers, where a throw skips every connection after
         * this one and is never tried again. A frame for a socket that is going is simply not delivered.
         */
        internal val out = Outbound { frame ->
            try {
                transport.send(frame)
            } catch (@Suppress("TooGenericExceptionCaught", "SwallowedException") undelivered: Exception) {
                // The close already on its way lets this connection go.
            }
        }

        var player: PlayerId? = null
            private set

        private val lock = Any()
        private val cells = LinkedHashSet<String>()
        private val waiting = ArrayDeque<Delta>()
        private var flushPlanned = false

        /** The world-day this connection is looking at, or null for live: the scrubber's position. */
        @Volatile
        private var viewingAt: WorldTime? = null

        /**
         * Whether this connection has the eye open: significance set aside, so every house in a held cell
         * reaches it however far back the camera is. Read by the fan-out on another thread. See 0038.
         */
        @Volatile
        internal var seesEverything: Boolean = false
            private set

        /**
         * Whether the fog of war holds back what this connection's house cannot see: on, unless Adam's
         * switch has lifted it for this window. Read by the fan-out on another thread. See decision 0061.
         */
        @Volatile
        private var fogged: Boolean = true

        /** What the fog lets through, from the house's vision points: next to nothing until hello says whose. */
        @Volatile
        private var fog: Fog = Fog.NOBODY

        /** The world this connection's page draws, from hello, whose stands it is sent. Null, and it is sent none. */
        @Volatile
        private var master: String? = null

        /**
         * The stand tiles a held cell is over, as `y * STAND_TILES + x`, with what was last sent of each, so that
         * a tile is sent once while it is held and again only when what the fog lets through of it changes.
         */
        private val standsSent = HashMap<Int, ByteArray>()

        /** Set when this session is over, by a takeover or by the socket going away. It then does nothing. */
        @Volatile
        private var finished = false

        /** What each part keeps of this connection, made the first time the part asks and gone with it. */
        private val kept = ConcurrentHashMap<Part, Any>()

        /** What [part] keeps of this connection, made by [make] the first time it is asked for. */
        @Suppress("UNCHECKED_CAST")
        internal fun <T : Any> keptBy(part: Part, make: () -> T): T = kept.computeIfAbsent(part) { make() } as T

        /** Whether this session is over, by a takeover or by the socket going away. */
        internal val isFinished: Boolean get() = finished

        private fun viewing(): WorldTime = viewingAt ?: world.today()

        /** Whether a change is on this connection's day. Live sees everything; the past sees what existed then. */
        internal fun sees(row: HouseRow): Boolean = viewingAt?.let { row.existsAt(it) } ?: true

        /** Whether this connection is looking at the world as it is today, rather than at an earlier day. */
        internal val isLive: Boolean get() = viewingAt == null

        /** Whether the fog lets this house through to this connection. */
        internal fun letsSee(row: HouseRow): Boolean = !fogged || fog.letsThrough(row)

        /** Whether the fog lets this character, standing here, through to this connection on its day. */
        internal fun letsSee(row: CharacterRow, span: CharacterSpan): Boolean =
            !fogged || fog.letsThrough(row, span, viewing())

        /**
         * Takes the house's new sight: tells the player, and answers every held cell again, because what they
         * may be sent has changed with it - a house on ground newly revealed, somebody newly in vision or out
         * of it. The sight first, so the page is drawing the new fog when what it lets through arrives.
         */
        internal fun sightChanged(sight: Sight) {
            fog = Fog(player, sight.points)
            out.send(YourSight(sight.toView(), Vision.SURFACE_TENSION))
            if (fogged) {
                answerAgain()
                standsAgain()
            }
        }

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
                is Command -> command(frame)
                is SubscribeCells -> subscribe(frame.cells)
                is UnsubscribeCells -> unsubscribe(frame.cells)
                is ViewTime -> viewTime(frame.at)
                // The core answers the kinds in CORE_FRAMES above, and a part every other.
                else -> frames.handle(this, frame)
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
            // Before anything is sent, so that the first cell this connection holds is already fogged.
            fog = Fog(who, sights.of(HouseId.of(who)).points)
            master = frame.master

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
            parts.forEach { it.greet(this, who) }
        }

        /**
         * Ends this session without ending its socket: it holds no cells, hears nothing more and accepts
         * nothing more. The gateway does not close sockets - `Outbound` says frames and nothing else - so
         * the client is told and closes its own. One that does not is left holding something inert.
         */
        internal fun standDown() = finish(TakenOver("another window took this player over"))

        /**
         * Ends this session without ending its socket, and says why. The gateway does not close sockets;
         * the client is told and closes its own.
         */
        internal fun finish(why: ServerFrame) {
            synchronized(lock) {
                if (finished) return
                finished = true
            }
            letEverythingGo()
            live -= this
            out.send(why)
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
                commands.handle(Asking(who, commandId), frame.command)
                out.send(CommandAccepted(frame.commandId))
            } catch (@Suppress("SwallowedException") closed: InstrumentsClosed) {
                out.send(CommandRejected(frame.commandId, "instrumentsClosed"))
            } catch (refused: DomainError) {
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
                // Taken up under the lock that letting go is done under, so a connection finished meanwhile holds nothing.
                if (finished) return
                val new = asked.distinct().filter { it !in cells }
                if (cells.size + new.size > MOST_CELLS) {
                    out.send(ErrorFrame("tooManyCells", "a connection holds at most $MOST_CELLS cells; zoom in"))
                    return
                }
                cells += new
                new.forEach { holding.hold(it, this) }
                new
            }
            fresh.forEach(::snapshot)
            if (master != null) {
                val tiles = synchronized(lock) { fresh.flatMap(::standTilesUnder).distinct().filter { it !in standsSent } }
                offerStands(tiles, again = false)
            }
        }

        /**
         * Sends each tile's stands as far as the fog lets them through: a tile newly under a held cell whatever
         * it holds, empty or not, so the page knows it has all there is; a tile already held only if that has
         * changed. What the fog holds back is left out, and nothing says how much was.
         */
        private fun offerStands(tiles: Collection<Int>, again: Boolean) {
            for (tile in tiles) {
                val x = tile % STAND_TILES
                val y = tile / STAND_TILES
                val through = standsOf(x, y)
                val send = synchronized(lock) {
                    val was = standsSent[tile]
                    if ((again && was == null) || (was != null && was.contentEquals(through))) {
                        false
                    } else {
                        standsSent[tile] = through
                        true
                    }
                }
                if (send) {
                    out.send(StandsFrame(x, y, Base64.getEncoder().encodeToString(through)))
                }
            }
        }

        /** The stands of one tile of this connection's world that its fog lets through. A world it has none of has none. */
        private fun standsOf(x: Int, y: Int): ByteArray {
            val all = master?.let { stands.of(it, x, y) } ?: return ByteArray(0)
            if (!fogged) {
                return all
            }
            val seeing = fog
            return StandRecords.only(all) { at ->
                seeing.letsThrough(StandRecords.x(all, at, x), StandRecords.y(all, at, y), StandRecords.reach(all, at))
            }
        }

        /** Every held stand tile answered again, for a connection whose fog has changed. Only what changed goes. */
        private fun standsAgain() {
            offerStands(synchronized(lock) { standsSent.keys.toList() }, again = true)
        }

        /** What the cell holds on the day this connection is looking at, and of that what its fog lets through. */
        private fun snapshot(cell: String) {
            val contents = houses.inCell(cell, viewing(), MOST_IN_A_CELL, seesEverything) { letsSee(it) }
            val standing = onTheMap.inCell(cell, viewing(), MOST_IN_A_CELL, seesEverything) { placed: PlacedCharacter ->
                letsSee(placed.row, placed.span)
            }
            out.send(
                Snapshot(
                    cell = cell,
                    houses = contents.houses.map { it.toView() },
                    asOfVersion = contents.asOf,
                    omitted = contents.omitted,
                    characters = standing.characters.map { it.row.toMapView(it.span) },
                    omittedCharacters = standing.omitted,
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
            answerAgain()
        }

        /**
         * Opens or closes the eye, and answers every held cell again so the map redraws at once rather
         * than at the next pan. Modelled on `viewTime`: both change what is shown, not what is held.
         */
        internal fun seeAll(on: Boolean) {
            if (on == seesEverything) {
                return
            }
            seesEverything = on
            answerAgain()
        }

        /**
         * Lifts the fog for this connection or lets it fall again, and answers every held cell again, as the
         * eye does: both change what is shown, not what is held. See decision record 0061.
         */
        internal fun fogOfWar(on: Boolean) {
            if (on == fogged) {
                return
            }
            fogged = on
            answerAgain()
            standsAgain()
        }

        /** Every held cell answered again, for a connection whose way of looking has changed. */
        private fun answerAgain() {
            for (cell in cells()) {
                snapshot(cell)
            }
        }

        private fun unsubscribe(asked: List<String>) {
            synchronized(lock) {
                cells -= asked.toSet()
                // A tile no held cell is over any more is let go, so coming back to it sends it afresh.
                standsSent.keys.retainAll(cells.flatMap(::standTilesUnder).toSet())
            }
            asked.forEach { holding.letGo(it, this) }
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
                    standsSent.clear()
                } else {
                    waiting.addLast(delta)
                    if (!flushPlanned) {
                        flushPlanned = true
                        plan = true
                    }
                }
            }
            letGo?.let { gone ->
                gone.forEach { holding.letGo(it, this) }
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
                val distinct = waiting.distinctBy { it.key }
                waiting.clear()
                distinct
            }
            if (batch.isNotEmpty()) {
                out.send(Batch(batch))
            }
        }

        fun disconnected() {
            live -= this
            synchronized(lock) { finished = true }
            letEverythingGo()
            // Only if this is still the session: the loser of a takeover often closes afterwards, and
            // removing by key alone would evict the window that just won.
            player?.let { sessions.remove(it, this) }
        }

        private fun letEverythingGo() {
            parts.forEach { it.ended(this) }
            synchronized(lock) {
                standsSent.clear()
                cells.forEach { holding.letGo(it, this) }
                cells.clear()
            }
        }
    }
}
