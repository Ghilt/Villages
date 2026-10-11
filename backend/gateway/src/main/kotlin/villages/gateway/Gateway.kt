package villages.gateway

import java.time.Clock
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executor
import villages.application.CharactersByCell
import villages.application.Faults
import villages.application.HousesByCell
import villages.application.Later
import villages.application.PlayerTokens
import villages.application.StructuresByCell
import villages.application.WorldClock
import villages.domain.PlayerId
import villages.protocol.Batch
import villages.protocol.ClientFrame
import villages.protocol.Command
import villages.protocol.Delta
import villages.protocol.ErrorFrame
import villages.protocol.Hello
import villages.protocol.Ping
import villages.protocol.Pong
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.ProtocolJson
import villages.protocol.Resync
import villages.protocol.ServerFrame
import villages.protocol.SubscribeCells
import villages.protocol.TakenOver
import villages.protocol.UnsubscribeCells
import villages.protocol.Welcome
import villages.protocol.WorldNow
import villages.protocol.WorldWiped

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
 * The fan-out is decision 0026 on the write side: a changed house has one deepest cell, and every connection that
 * should hear of it holds one of its prefixes, from the zoom its significance is drawn at down: eleven lookups.
 *
 * Nothing reaches a connection that its house's fog of war holds back, a snapshot, a delta or a window's answer:
 * `Fog` is asked of everything before it goes (0061), the scenery's stands included (0067).
 */
class Gateway(
    private val tokens: PlayerTokens,
    faults: Faults,
    private val houses: HousesByCell,
    private val clock: Clock,
    private val world: WorldClock,
    private val onTheMap: CharactersByCell,
    /** The structures on the map, which a cell's snapshot carries beside the houses and the people. */
    private val structures: StructuresByCell,
    /** What every part is made from, a mechanic's ports apiece: see [Mechanics]. */
    mechanics: Mechanics,
    private val later: Later,
    /**
     * What a connection's frames are sent on, and its cells answered again on: the thread that queued them, unless
     * the gateway is given threads of its own, as the app gives it. See decision record 0077.
     */
    private val sendOn: Executor = Executor { it.run() },
) : AutoCloseable {
    /** Whether Adam's instruments are open, which says whether hello says where the world is kept. */
    private val instrumentsOpen = mechanics.instrumentsOpen

    /** Where the world is kept and what of it cannot be read: said at hello, while the instruments are open. */
    private val worldKept = mechanics.worldKept

    /** What every connection is shown of a structure's slots. */
    private val slotsSeen = SlotsSeen(mechanics.structureCatalogue, mechanics.characterById)

    /** Which connections hold each cell: the whole of the fan-out index. */
    private val holding = CellIndex<Connection>()

    /** The one session a player has: a second hello takes the player over and the older is stood down (0028). */
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

    /** A part for each mechanic, made after the index and the sessions: see [partsOf] and decision record 0075. */
    private val parts: List<Part> = partsOf(core, mechanics, houses, onTheMap, structures, world)

    /** Every command the gateway takes, and every frame a part answers, each with the one part that handles it. */
    private val commands = Commands()
    private val frames = Frames()

    init {
        parts.forEach { it.register(commands, frames) }
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
        faulted.close()
    }

    inner class Connection(private val transport: Outbound) {
        /**
         * Every frame to this connection goes out through here, queued and sent one at a time, and nothing a send
         * throws gets past it. The fan-outs send from inside the read models' watchers, where a throw would skip
         * every connection after this one and never be tried again. See [Outbox].
         */
        internal val out: Outbound = Outbox(transport, sendOn)

        var player: PlayerId? = null
            private set

        private val lock = Any()
        private val cells = LinkedHashSet<String>()
        private val waiting = ArrayDeque<Delta>()
        private var flushPlanned = false

        /** How this connection is looking at the world, replaced whole: see [Looking]. Read by the fan-outs too. */
        @Volatile
        internal var looking: Looking = Looking(slots = slotsSeen)
            private set

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

        /** Changes how this connection is looking, and hands back how it looked before. */
        internal fun look(change: (Looking) -> Looking): Looking = synchronized(lock) { looking.also { looking = change(it) } }

        /** How this connection looked before the first change not yet answered, while an answer is planned. */
        private var unanswered: Looking? = null

        /**
         * Every held cell answered again, and every part told, for a connection whose way of looking has changed
         * from [was]: a snapshot of each as it now looks, and whatever a part sends again of its own. Planned on
         * the threads frames are sent on, and once: a change made while an answer is still to come is answered by
         * it, so a house whose sight moves ten times in a breath is not sent every cell ten times, and the read
         * model's thread a new sight arrives on works out none of it.
         */
        internal fun lookedAgain(was: Looking) {
            synchronized(lock) {
                if (unanswered != null) {
                    return
                }
                unanswered = was
            }
            sendOn.execute {
                val from = synchronized(lock) { unanswered.also { unanswered = null } } ?: return@execute
                answerAgain()
                val now = looking
                parts.forEach { it.lookingChanged(this, from, now) }
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
                is Command -> commands.answer(frame, player, out)
                is SubscribeCells -> subscribe(frame.cells)
                is UnsubscribeCells -> unsubscribe(frame.cells)
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
            parts.forEach { it.arrive(this, frame, who) }

            // A player plays from one place. Whoever arrives last is the session; the one before is done.
            sessions.put(who, this)?.takeIf { it !== this }?.standDown()

            val today = world.today()
            out.send(
                Welcome(
                    serverTime = clock.millis(),
                    playerId = who.value.toString(),
                    world = WorldNow(today = today.day, earliest = (houses.earliest() ?: today).day),
                    keptIn = worldKept.keptIn.takeIf { instrumentsOpen },
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
            parts.forEach { it.cellsTaken(this, fresh) }
        }

        /** What the cell holds on the day this connection is looking at, and of that what its fog lets through. */
        private fun snapshot(cell: String) = out.send(snapshotOf(cell, looking, world, onTheMap, structures))

        /** Every held cell answered again, for a connection whose way of looking has changed. */
        private fun answerAgain() {
            for (cell in cells()) {
                snapshot(cell)
            }
        }

        private fun unsubscribe(asked: List<String>) {
            val still = synchronized(lock) {
                cells -= asked.toSet()
                cells.toSet()
            }
            asked.forEach { holding.letGo(it, this) }
            parts.forEach { it.cellsLetGo(this, still) }
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
                gone.forEach { holding.letGo(it, this) }
                parts.forEach { it.cellsLetGo(this, emptySet()) }
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
                cells.forEach { holding.letGo(it, this) }
                cells.clear()
            }
        }
    }
}
