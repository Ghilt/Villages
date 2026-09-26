package villages.gateway

import villages.application.Arrival
import villages.application.CharacterRow
import villages.application.ChoiceRow
import villages.application.ChoicesByPlayer
import villages.application.EventFeed
import villages.application.FoundHouseService
import villages.application.CharacterMapChange
import villages.application.CharacterSpan
import villages.application.CharactersByCell
import villages.application.HouseChange
import villages.application.HouseRow
import villages.application.HousesByCell
import villages.application.HousesByPlayer
import villages.application.KeyFigureService
import villages.application.KeyFiguresByHouse
import villages.application.PlayerTokens
import villages.application.Later
import villages.application.Provenance
import villages.application.ScheduledLater
import villages.application.Sight
import villages.application.SightsByHouse
import villages.application.RecentEvents
import villages.application.ResourceService
import villages.application.Start
import villages.application.StoredEvent
import villages.application.TakeActionService
import villages.application.VisionService
import villages.application.VisionSource
import villages.application.WorldClock
import villages.application.WorldWipe
import villages.application.WriteConflict
import villages.domain.Banner
import villages.domain.CharacterError
import villages.domain.CharacterId
import villages.domain.Choice
import villages.domain.ChoiceId
import villages.domain.Effect
import villages.domain.DomainError
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.OptionId
import villages.domain.PlayerId
import villages.domain.PledgeId
import villages.domain.Resource
import villages.domain.Stat
import villages.domain.VisionId
import villages.domain.WorldTime
import villages.protocol.AddKeyFigurePayload
import villages.protocol.AgeCharacterPayload
import villages.protocol.BannerSpec
import villages.protocol.Batch
import villages.protocol.Cell
import villages.protocol.ChangePortraitPayload
import villages.protocol.ChangeStatPayload
import villages.protocol.Charge
import villages.protocol.ChoiceView
import villages.protocol.ClientFrame
import villages.protocol.Command
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.Delta
import villages.protocol.Division
import villages.protocol.EffectView
import villages.protocol.ErrorFrame
import villages.protocol.EventFrame
import villages.protocol.FoundAtView
import villages.protocol.FoundHousePayload
import villages.protocol.GiveVisionPayload
import villages.protocol.GrantResourcePayload
import villages.protocol.Hello
import villages.protocol.HolderView
import villages.protocol.CharacterArrived
import villages.protocol.CharacterChanged
import villages.protocol.CharacterGone
import villages.protocol.CharacterOnMapView
import villages.protocol.HouseAppeared
import villages.protocol.HouseChanged
import villages.protocol.MoveCharacterPayload
import villages.protocol.TakeOffTheMapPayload
import villages.protocol.TakeVisionPayload
import villages.protocol.HouseView
import villages.protocol.KeyFigureView
import villages.protocol.KillCharacterPayload
import villages.protocol.OptionView
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.Ping
import villages.protocol.PledgeResourcePayload
import villages.protocol.PledgeView
import villages.protocol.Point
import villages.protocol.Pong
import villages.protocol.ProtocolJson
import villages.protocol.ReleasePledgePayload
import villages.protocol.Resync
import villages.protocol.SeeAll
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.SpendResourcePayload
import villages.protocol.StatsView
import villages.protocol.Stock
import villages.protocol.SubscribeCells
import villages.protocol.TakeActionPayload
import villages.protocol.TakenOver
import villages.protocol.Tincture
import villages.protocol.UnsubscribeCells
import villages.protocol.VisionPointView
import villages.protocol.ViewTime
import villages.protocol.WatchEvents
import villages.protocol.Welcome
import villages.protocol.WipeWorld
import villages.protocol.WorldNow
import villages.protocol.WorldWiped
import villages.protocol.YourChoice
import villages.protocol.YourHouse
import villages.protocol.YourHouseView
import villages.protocol.YourKeyFigures
import villages.protocol.YourSight
import villages.protocol.coarsestZoom
import java.time.Clock
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
 * How much of the end of the chronicle a watcher is given when it starts watching.
 *
 * A viewer that has just been opened has missed everything, and the world did not begin when it did.
 * What is served is whatever the read model still holds, so asking for more than it keeps is harmless.
 */
const val MOST_RECENT_EVENTS = 100

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
    private val arrival: Arrival,
    private val takeAction: TakeActionService,
    private val resources: ResourceService,
    private val choices: ChoicesByPlayer,
    private val recent: RecentEvents,
    private val emptyTheWorld: WorldWipe,
    private val keyFigures: KeyFigureService,
    private val figures: KeyFiguresByHouse,
    private val onTheMap: CharactersByCell,
    private val sights: SightsByHouse,
    private val visions: VisionService,
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

    /** Every live connection, so that a wipe can tell all of them and not only the introduced ones. */
    private val live = ConcurrentHashMap.newKeySet<Connection>()

    // From now: the debug panel watches the world happening, and would not thank us for the whole
    // chronicle replayed at it on every connect.
    private val feed: AutoCloseable = events.subscribe(Start.FROM_NOW) { stored -> fanOutEvent(stored) }
    private val changes: AutoCloseable = houses.watch { change -> fanOutChange(change) }

    /** What a player has to decide reaches them wherever they are looking, like their house does. */
    private val asked: AutoCloseable = choices.watch { player, row ->
        sessions[player]?.tellChoice(row?.choice?.toView())
    }

    /**
     * A house's key figures reach its player wherever they are looking, like the house does: whom a house
     * holds is its own, and needs no cell. See decision record 0055.
     */
    private val figuresChanged: AutoCloseable = figures.watch { change ->
        sessions[change.player]?.out?.send(YourKeyFigures(change.keyFigures.map { it.toView() }))
    }

    /** A character who moves, leaves the map or dies on it reaches whoever holds the cells either side. */
    private val moves: AutoCloseable = onTheMap.watchTheMap { change -> fanOutMove(change) }

    /**
     * What a house sees reaches its player wherever they are looking, like the house does: the fog of war is
     * the player's own, and needs no cell. See decision record 0061.
     */
    private val seen: AutoCloseable = sights.watch { change ->
        sessions[change.player]?.out?.send(YourSight(change.sight.toView()))
    }

    fun connect(out: Outbound): Connection = Connection(out).also { live += it }

    /**
     * Empties the world and finishes every session with it.
     *
     * Everybody is told, because a wipe is everybody's: a window left holding a house that no longer
     * exists would be showing a world that is not there. Each one reloads and arrives anew. See 0036.
     */
    private fun wipeTheWorld() {
        val gone = emptyTheWorld.wipe()
        sessions.clear()
        for (connection in live) {
            connection.finish(WorldWiped("the world was emptied; $gone event${if (gone == 1) "" else "s"} went"))
        }
    }

    private fun fanOutEvent(stored: StoredEvent) {
        val frame = stored.toFrame()
        for (connection in watching.keys) {
            connection.out.send(frame)
        }
    }

    private fun fanOutChange(change: HouseChange) {
        val row = change.row
        val deepest = Cell.of(row.seat.lat, row.seat.lon)
        val view = row.toView(deepest)

        // Your own house reaches you wherever you are looking, not only when you hold its cell.
        sessions[row.player]?.out?.send(YourHouse(row.toYours(deepest)))

        // Whether it is new is the read model's answer, not the stream version's: a house founded from a
        // choice arrives at version three, behind the choice it was given and the action that took it.
        val delta: Delta = if (change.appeared) HouseAppeared(view) else HouseChanged(view)
        val coarsest = coarsestZoom(row.significance.value)
        // Every zoom, not only the ones this house is significant enough for: a connection with the eye
        // open holds shallower cells and is owed the change in them too. Still eleven lookups. See 0038.
        for (zoom in 0..Cell.MAX_ZOOM) {
            val holders = holding[deepest.at(zoom).quadkey] ?: continue
            for (connection in holders) {
                if ((zoom >= coarsest || connection.seesEverything) && connection.sees(row)) {
                    connection.enqueue(delta)
                }
            }
        }
    }

    /**
     * A character's move, told to each connection as the one delta that fits it.
     *
     * A house never moves, so its fan-out only ever adds; a character leaves cells as well as entering
     * them, and a connection that is not told so goes on drawing them where they were. So who was shown
     * them before is worked out as well as who is shown them now: a connection in both is told they
     * changed, one only in the second that they arrived, one only in the first that they are gone. Only
     * connections looking at the live world: a move today changes no earlier day's map.
     */
    private fun fanOutMove(change: CharacterMapChange) {
        val before = heldAt(change.was)
        val after = heldAt(change.now)
        val view = change.now?.let { change.row.toMapView(it) }
        if (view != null) {
            for (connection in after) {
                if (connection.isLive) {
                    connection.enqueue(if (connection in before) CharacterChanged(view) else CharacterArrived(view))
                }
            }
        }
        for (connection in before - after) {
            if (connection.isLive) {
                connection.enqueue(CharacterGone(change.row.id.value.toString(), change.row.revision))
            }
        }
    }

    /**
     * The connections a character standing in this span is drawn for: every one holding a cell their place
     * falls in, from the zoom their significance is worth drawing at, or at any zoom with the eye open.
     */
    private fun heldAt(span: CharacterSpan?): Set<Connection> {
        if (span == null) {
            return emptySet()
        }
        val deepest = Cell.of(span.place.lat, span.place.lon)
        val coarsest = coarsestZoom(span.significance.value)
        val found = mutableSetOf<Connection>()
        for (zoom in 0..Cell.MAX_ZOOM) {
            val holders = holding[deepest.at(zoom).quadkey] ?: continue
            for (connection in holders) {
                if (zoom >= coarsest || connection.seesEverything) {
                    found += connection
                }
            }
        }
        return found
    }

    override fun close() {
        feed.close()
        changes.close()
        asked.close()
        figuresChanged.close()
        moves.close()
        seen.close()
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

        /**
         * Whether this connection has the eye open: significance set aside, so every house in a held cell
         * reaches it however far back the camera is. Read by the fan-out on another thread. See 0038.
         */
        @Volatile
        internal var seesEverything: Boolean = false
            private set

        /** Set when this session is over, by a takeover or by the socket going away. It then does nothing. */
        @Volatile
        private var finished = false

        /** Which choice this connection has been told of, and whether it has been told anything at all. */
        private var toldChoice: String? = null
        private var everToldChoice = false

        private fun viewing(): WorldTime = viewingAt ?: world.today()

        /**
         * Says what this player has to decide, unless they have already been told of that same choice.
         *
         * Two paths lead here and either may run first: the hello that gave the choice, and the watch on
         * the read model that folded it. Without the guard a player would be told the same thing twice on
         * arriving. The first call always sends, even with nothing pending, so the answer to hello is
         * definite in the way `yourHouse` is.
         */
        internal fun tellChoice(choice: ChoiceView?) {
            synchronized(lock) {
                if (finished || (everToldChoice && choice?.id == toldChoice)) {
                    return
                }
                everToldChoice = true
                toldChoice = choice?.id
            }
            out.send(YourChoice(choice))
        }

        /** Whether a change is on this connection's day. Live sees everything; the past sees what existed then. */
        internal fun sees(row: HouseRow): Boolean = viewingAt?.let { row.existsAt(it) } ?: true

        /** Whether this connection is looking at the world as it is today, rather than at an earlier day. */
        internal val isLive: Boolean get() = viewingAt == null

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
                is WatchEvents -> if (frame.on) watchEvents() else watching.remove(this)
                is Command -> command(frame)
                is SubscribeCells -> subscribe(frame.cells)
                is UnsubscribeCells -> unsubscribe(frame.cells)
                is ViewTime -> viewTime(frame.at)
                is SeeAll -> seeAll(frame.on)
                is WipeWorld -> wipeTheWorld()
            }
        }

        /**
         * Starts sending this connection every event, beginning with what it missed.
         *
         * Watching first and replaying after, so that nothing appended in between is lost. The cost is
         * that something can arrive twice, which is the feed's own bargain and the reader's to absorb.
         */
        private fun watchEvents() {
            watching[this] = Unit
            for (stored in recent.latest(MOST_RECENT_EVENTS)) {
                out.send(stored.toFrame())
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
            out.send(YourHouse(theirHouses.ofPlayer(who)?.toYours()))
            out.send(YourKeyFigures(figures.of(HouseId.of(who)).map { it.toView() }))
            out.send(YourSight(sights.of(HouseId.of(who)).toView()))

            // Arriving with no house and nothing to decide is what the founding choice answers. The
            // choice arrive() hands back is what goes out, not a read of the projection: the projection
            // folds on another thread and would sometimes say "nothing" about a choice just written.
            val given = try {
                arrival.arrive(who)
            } catch (@Suppress("TooGenericExceptionCaught") wrong: RuntimeException) {
                out.send(ErrorFrame("arrival", wrong.message ?: "could not be given a choice"))
                null
            }
            tellChoice((given ?: choices.pendingOf(who)?.choice)?.toView())
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
            if (finished) {
                return
            }
            finished = true
            letEverythingGo()
            live -= this
            out.send(why)
        }

        /** The story the pending choice began, so an action answering it belongs to that story. */
        private fun pendingStory(who: PlayerId): java.util.UUID? =
            choices.pendingOf(who)?.let { row -> runCatching { java.util.UUID.fromString(row.correlationId) }.getOrNull() }

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

                    is GrantResourcePayload -> resources.grant(
                        player = who,
                        resource = asResource(payload.resource),
                        amount = payload.amount,
                        provenance = Provenance.startedBy(commandId),
                    )

                    is SpendResourcePayload -> resources.spend(
                        player = who,
                        resource = asResource(payload.resource),
                        amount = payload.amount,
                        provenance = Provenance.startedBy(commandId),
                    )

                    is PledgeResourcePayload -> resources.pledge(
                        player = who,
                        resource = asResource(payload.resource),
                        amount = payload.amount,
                        months = payload.months,
                        purpose = payload.purpose,
                        provenance = Provenance.startedBy(commandId),
                    )

                    is ReleasePledgePayload -> resources.release(
                        player = who,
                        pledgeId = PledgeId(asUuid(payload.pledgeId, "a pledge id")),
                        provenance = Provenance.startedBy(commandId),
                    )

                    is TakeActionPayload -> takeAction.take(
                        player = who,
                        choiceId = ChoiceId(asUuid(payload.choiceId, "a choice id")),
                        optionId = OptionId(asUuid(payload.optionId, "an option id")),
                        // An action continues the story the choice began, so the action and what it does
                        // wear the same correlation as the question. The server decides this, not the
                        // client: nothing about correlation crosses the wire. See decision record 0035.
                        provenance = Provenance(
                            commandId = commandId,
                            correlationId = pendingStory(who) ?: commandId,
                        ),
                    )

                    is AddKeyFigurePayload -> keyFigures.add(who, Provenance.startedBy(commandId))

                    is ChangeStatPayload -> keyFigures.changeStat(
                        player = who,
                        characterId = CharacterId(asUuid(payload.characterId, "a character id")),
                        stat = asStat(payload.stat),
                        by = payload.by,
                        provenance = Provenance.startedBy(commandId),
                    )

                    is AgeCharacterPayload -> keyFigures.age(
                        player = who,
                        characterId = CharacterId(asUuid(payload.characterId, "a character id")),
                        years = payload.years,
                        provenance = Provenance.startedBy(commandId),
                    )

                    is ChangePortraitPayload -> keyFigures.changePortrait(
                        player = who,
                        characterId = CharacterId(asUuid(payload.characterId, "a character id")),
                        portrait = payload.portrait,
                        provenance = Provenance.startedBy(commandId),
                    )

                    is KillCharacterPayload -> keyFigures.kill(
                        player = who,
                        characterId = CharacterId(asUuid(payload.characterId, "a character id")),
                        cause = payload.cause,
                        provenance = Provenance.startedBy(commandId),
                    )

                    // A place off the world is refused by the place itself, as `invalidLocation`.
                    is MoveCharacterPayload -> keyFigures.move(
                        player = who,
                        characterId = CharacterId(asUuid(payload.characterId, "a character id")),
                        place = Location(payload.place.lat, payload.place.lon),
                        provenance = Provenance.startedBy(commandId),
                    )

                    is TakeOffTheMapPayload -> keyFigures.takeOffTheMap(
                        player = who,
                        characterId = CharacterId(asUuid(payload.characterId, "a character id")),
                        provenance = Provenance.startedBy(commandId),
                    )

                    // A place off the world is refused by the place itself, as `invalidLocation`.
                    is GiveVisionPayload -> visions.give(
                        player = who,
                        place = Location(payload.place.lat, payload.place.lon),
                        provenance = Provenance.startedBy(commandId),
                    )

                    is TakeVisionPayload -> visions.take(
                        player = who,
                        visionId = VisionId(asUuid(payload.visionId, "a vision id")),
                        provenance = Provenance.startedBy(commandId),
                    )
                }
                out.send(CommandAccepted(frame.commandId))
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
            val contents = houses.inCell(cell, viewing(), MOST_IN_A_CELL, seesEverything)
            val standing = onTheMap.inCell(cell, viewing(), MOST_IN_A_CELL, seesEverything)
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
            for (cell in cells()) {
                snapshot(cell)
            }
        }

        /**
         * Opens or closes the eye, and answers every held cell again so the map redraws at once rather
         * than at the next pan. Modelled on `viewTime`: both change what is shown, not what is held.
         */
        private fun seeAll(on: Boolean) {
            if (on == seesEverything) {
                return
            }
            seesEverything = on
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

/** An identifier off the wire, or a refusal saying which one was not one. */
/** A resource named on the wire, or the refusal. The wire's names are the code's; see 0053 and the naming rule. */
private fun asResource(name: String): Resource =
    Resource.entries.firstOrNull { it.toWire() == name }
        ?: throw IllegalArgumentException("not a resource: $name")

private fun asUuid(value: String, what: String): java.util.UUID =
    runCatching { java.util.UUID.fromString(value) }
        .getOrElse { throw IllegalArgumentException("$what is a UUID, not $value") }

/** A stat named on the wire, which is its name in lower case, or the refusal. */
private fun asStat(name: String): Stat =
    Stat.entries.firstOrNull { it.name.lowercase() == name }
        ?: throw IllegalArgumentException("not a stat: $name")

/**
 * A key figure as the pane shows them: the whole row, with the stats, because this goes to the session of a
 * house that holds them and to nobody else. See decision record 0055.
 */
internal fun CharacterRow.toView(): KeyFigureView = KeyFigureView(
    id = id.value.toString(),
    givenName = name.given,
    familyName = name.family,
    sex = sex.name.lowercase(),
    species = species.name.lowercase(),
    bornOn = bornOn.day,
    agedYears = agedYears,
    stats = StatsView(
        piety = stats.getValue(Stat.PIETY),
        reason = stats.getValue(Stat.REASON),
        kindness = stats.getValue(Stat.KINDNESS),
        physical = stats.getValue(Stat.PHYSICAL),
    ),
    portrait = portrait,
    keyFigureOf = keyFigureOf.map { HolderView(it.house.value.toString(), it.name.value, it.banner.toWire()) },
    place = place?.let { Point(it.lat, it.lon) },
    version = revision,
)

/**
 * A character standing on the map as everyone holding the cell sees them: who and whose, how old and
 * where, and not the stats, which are their house's own. The span is where they stood on the day the map was asked about.
 */
internal fun CharacterRow.toMapView(span: CharacterSpan): CharacterOnMapView = CharacterOnMapView(
    id = id.value.toString(),
    givenName = name.given,
    familyName = name.family,
    sex = sex.name.lowercase(),
    species = species.name.lowercase(),
    bornOn = bornOn.day,
    agedYears = agedYears,
    portrait = portrait,
    place = Point(span.place.lat, span.place.lon),
    cell = Cell.of(span.place.lat, span.place.lon).quadkey,
    keyFigureOf = keyFigureOf.map { HolderView(it.house.value.toString(), it.name.value, it.banner.toWire()) },
    since = span.since.day,
    version = revision,
)

/**
 * A house's vision points as the page draws its fog from them: every one it has had, oldest first. The
 * radius stays in kilometres; how big that is on the map is the page's to work out. See decision 0061.
 */
internal fun Sight.toView(): List<VisionPointView> = points.map { point ->
    VisionPointView(
        kind = when (point.source) {
            VisionSource.Seat -> "seat"
            is VisionSource.KeyFigure -> "keyFigure"
            is VisionSource.Given -> "given"
        },
        of = when (val source = point.source) {
            VisionSource.Seat -> null
            is VisionSource.KeyFigure -> source.character.value.toString()
            is VisionSource.Given -> source.vision.value.toString()
        },
        place = Point(point.place.lat, point.place.lon),
        radius = point.radius,
        since = point.since.day,
        until = point.until?.day,
    )
}

/** A choice as the parchment shows it. What the interface renders and the whole of what it knows. */
internal fun Choice.toView(): ChoiceView = ChoiceView(
    id = id.value.toString(),
    prompt = prompt,
    options = options.map { option ->
        OptionView(
            id = option.id.value.toString(),
            label = option.label,
            detail = option.detail,
            effect = option.effect.toView(),
        )
    },
)

internal fun Effect.toView(): EffectView = when (this) {
    is Effect.FoundAt -> FoundAtView(
        seat = Point(seat.lat, seat.lon),
        name = name.value,
        banner = banner.toWire(),
    )
}

/** What makes two deltas the same one: the thing they are about and its version. */
private val Delta.key: Pair<String, Long>
    get() = when (this) {
        is HouseAppeared -> house.id to house.version
        is HouseChanged -> house.id to house.version
        is CharacterArrived -> "character:${character.id}" to character.version
        is CharacterChanged -> "character:${character.id}" to character.version
        is CharacterGone -> "character:$id" to version
    }

/** A domain refusal as the short code the protocol carries, which the interface turns into words. */
internal fun DomainError.reasonCode(): String = when (this) {
    HouseError.AlreadyFounded -> "alreadyFounded"
    is HouseError.InvalidName -> "invalidName"
    is DomainError.InvalidLocation -> "invalidLocation"
    is HouseError.InvalidBanner -> "invalidBanner"
    is HouseError.InvalidChoice -> "invalidChoice"
    HouseError.ChoicePending -> "choicePending"
    HouseError.NoChoicePending -> "noChoicePending"
    HouseError.NoSuchChoice -> "noSuchChoice"
    HouseError.NoSuchOption -> "noSuchOption"
    HouseError.NoSuchHouse -> "noSuchHouse"
    HouseError.NoSuchPledge -> "noSuchPledge"
    HouseError.TooManyKeyFigures -> "tooManyKeyFigures"
    HouseError.AlreadyAKeyFigure -> "alreadyAKeyFigure"
    HouseError.NoSuchKeyFigure -> "noSuchKeyFigure"
    HouseError.NoSuchVision -> "noSuchVision"
    is HouseError.InvalidVision -> "invalidVision"
    is HouseError.InvalidAmount -> "invalidAmount"
    is HouseError.InvalidPledge -> "invalidPledge"
    is HouseError.NotEnoughFree -> "notEnoughFree"
    CharacterError.AlreadyAppeared -> "alreadyAppeared"
    CharacterError.NoSuchCharacter -> "noSuchCharacter"
    CharacterError.AlreadyDead -> "alreadyDead"
    // The same words as a house's refusal of the same rule, because the interface says them the same way.
    is CharacterError.InvalidName -> "invalidName"
    is CharacterError.InvalidStat -> "invalidStat"
    is CharacterError.InvalidAge -> "invalidAge"
    is CharacterError.InvalidPortrait -> "invalidPortrait"
    is CharacterError.InvalidCause -> "invalidCause"
    CharacterError.NotOnTheMap -> "notOnTheMap"
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
    since = since.day,
    version = version,
)

/**
 * The player's own house: the public view, and what only its owner is told.
 *
 * `pledged` is summed here rather than sent as a list for the browser to add up, and the resources go on
 * this view rather than on `HouseView` so that what a house has reaches one session and not every
 * neighbour holding its cell.
 */
internal fun HouseRow.toYours(deepest: Cell = Cell.of(seat.lat, seat.lon)): YourHouseView = YourHouseView(
    house = toView(deepest),
    resources = Resource.entries.associate { resource ->
        val stock = stockOf(resource)
        resource.toWire() to Stock(
            total = stock.total,
            pledged = pledgedOf(resource),
            ratePerSecond = stock.ratePerSecond,
            asOf = stock.asOf.toEpochMilli(),
        )
    },
    pledges = pledges.map {
        PledgeView(
            id = it.id.value.toString(),
            resource = it.resource.toWire(),
            amount = it.amount,
            until = it.until.day,
            purpose = it.purpose,
        )
    },
)

/**
 * A resource's name on the wire: the code's name and not the player's, because the wire is code talking
 * to code and what a player is shown is the interface's to decide. Exhaustive, so a sixth resource cannot
 * reach the wire without somebody naming it. See the naming rule in `BUILDING-A-MECHANIC.md`.
 */
internal fun Resource.toWire(): String = when (this) {
    Resource.WEALTH -> "wealth"
    Resource.NATURAL_DOMAIN -> "naturalDomain"
    Resource.INFLUENCE -> "influence"
    Resource.REASON -> "reason"
    Resource.PIETY -> "piety"
}

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
