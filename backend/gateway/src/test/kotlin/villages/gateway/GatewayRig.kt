package villages.gateway

import villages.application.Antarctica
import villages.application.QuestService
import villages.application.StructureService
import villages.application.AnonymousTokens
import villages.application.Arrival
import villages.application.FaultBoard
import villages.application.FoundHouseService
import villages.application.IncomeService
import villages.application.KeyFigureService
import villages.application.Later
import villages.application.ResourceService
import villages.application.Seats
import villages.application.StandingEffects
import villages.application.Stands
import villages.application.TakeActionService
import villages.application.DialogueService
import villages.application.VisionService
import villages.application.WorldCalendar
import villages.application.WorldClock
import villages.application.started
import villages.application.fate.FateEngine
import villages.application.fate.GroundMap
import villages.application.fate.PlaceNames
import villages.application.fate.WaterAt
import villages.application.fate.FirstPools
import villages.application.fate.omenSources
import villages.application.fate.firstActions
import villages.application.fate.RollService
import villages.application.WipeGate
import villages.application.WorldKept
import villages.application.Shelf
import villages.domain.PlayerId
import villages.domain.WorldTime
import villages.projections.QuestsProjection
import villages.projections.StructuresProjection
import villages.projections.CharactersProjection
import villages.projections.ChoicesProjection
import villages.projections.LastRollsProjection
import villages.projections.DialoguesProjection
import villages.projections.HousesProjection
import villages.projections.RecentEventsProjection
import villages.projections.SightProjection
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.ServerFrame
import villages.protocol.Calendar
import villages.protocol.STAND_TILES
import java.time.Clock
import java.time.ZoneOffset
import java.util.UUID
import java.util.concurrent.Executor

/*
 * What the gateway's specs stand on: a world small enough to hold in a test, a later that is whenever the
 * test says, and a rig that builds the real projections and services over them. See the specs beside it.
 */

/**
 * Thirty days a month, which is enough for a test about stepping. What a month really is belongs to
 * `villages.protocol.Calendar` and is held to the shared fixture there, not here.
 */
internal val thirtyDayMonths = object : WorldCalendar {
    override fun plusMonths(day: WorldTime, months: Long) = WorldTime(day.day + months * 30)

    override fun monthsBetween(from: WorldTime, to: WorldTime) = (to.day - from.day) / 30
}

/** Later is whenever the test says. */
internal class ManualLater : Later {
    private val planned = mutableListOf<Runnable>()

    override fun schedule(delayMs: Long, action: Runnable) {
        planned += action
    }

    fun tick() {
        val due = planned.toList()
        planned.clear()
        due.forEach { it.run() }
    }

    val pending: Int get() = planned.size
}

/**
 * The whole gateway on a tiny world. `instrumentsOpen` is the setting, `villages.instruments`, and `sendOn` what
 * frames are sent on: the calling thread, unless a spec hands it threads, as the app does.
 */
internal class Rig(
    instrumentsOpen: Boolean = true,
    sendOn: Executor = Executor { it.run() },
    worldKept: WorldKept = WorldKept.IN_MEMORY,
    catalogues: Shelf? = null,
) {
    val world = TinyWorld()
    val later = ManualLater()
    val houses = HousesProjection(world).started()
    val choices = ChoicesProjection(world).started()
    val recent = RecentEventsProjection(world).started()
    val characters = CharactersProjection(world).started()
    val sights = SightProjection(world).started()
    val dialogueRows = DialoguesProjection(world).started()
    val questRows = QuestsProjection(world).started()
    val lastRolls = LastRollsProjection(world).started()
    /** The world-day the rig's clock says, which a test may move on to see what a day passing does. */
    var day: WorldTime = today
    val worldClock = WorldClock { day }

    /** The ground maps a roll reads where the page is looking, by master: none until a spec lays one down. */
    val grounds = mutableMapOf<String, GroundMap>()

    /** Each master's real names, by master: none until a spec lays some down. */
    val names = mutableMapOf<String, PlaceNames>()

    /** The choice roll over the first content, with a die that always comes up one: common, and the first in the draw. */
    val rolls = RollService(
        FateEngine(
            omenSources(
                houses, characters, characters, sights, dialogueRows, lastRolls,
                months = { Calendar.monthOf(it.day) }, grounds = { grounds[it] }, housesNear = houses,
                names = { names[it] },
            ),
            FirstPools.ALL, firstActions(houses) { UUID.randomUUID() }, { 1 }, { UUID.randomUUID() },
        ),
        houses, world, { noon }, worldClock, { UUID.randomUUID() },
    )
    var minted = 0

    /** The one master's stands, tile by tile, as the sprite map's folder would hold them. */
    val standsOnDisk = mutableMapOf<Int, ByteArray>()

    /** The structures on the map, folded from the world as the app's are. */
    val structuresOnTheMap = StructuresProjection(world).started()

    /** Where the gateway hears that something acting on its own threw, said on purpose by a test. */
    val faults = FaultBoard()

    /**
     * What the app's listeners plan - the seats listener raising a house's castle as it is founded, the
     * standing-effects listener giving the house its sight and its income - kept apart from the gateway's own later
     * and done only when a test asks, with [settle]. A test that does not ask sees a house in the moment before:
     * founded, with no castle yet and nothing it sees from.
     */
    val reactions = ManualLater()

    init {
        val gate = WipeGate()
        Seats(world, reactions, faults, gate, world, world, { noon }).started()
        StandingEffects(
            world, reactions, faults, gate, { RIG_CATALOGUE },
            VisionService(world, { noon }, worldClock) { UUID.fromString("e2000000-0000-4000-8000-%012x".format(++minted)) },
            IncomeService(world, { noon }, worldClock),
        ).started()
    }

    /** Lets the listeners do whatever they have planned, and whatever that plans in turn: a founding's castle and its sight. */
    fun settle() {
        while (reactions.pending > 0) reactions.tick()
    }

    val gateway = Gateway(
        tokens = AnonymousTokens,
        faults = faults,
        houses = houses,
        clock = Clock.fixed(noon, ZoneOffset.UTC),
        world = worldClock,
        onTheMap = characters,
        structures = structuresOnTheMap,
        mechanics = Mechanics(
            foundHouse = FoundHouseService(world, clock = { noon }, world = worldClock),
            events = world,
            houseById = houses,
            theirHouses = houses,
            arrival = Arrival(
                world,
                clock = { noon },
                world = worldClock,
                // Known ids rather than random ones, so a story can be named in an assertion.
                ids = { UUID.fromString("a1000000-0000-4000-8000-%012x".format(++minted)) },
            ),
            takeAction = TakeActionService(world, clock = { noon }, world = worldClock),
            rolls = rolls,
            resources = ResourceService(
                world,
                clock = { noon },
                world = worldClock,
                calendar = thirtyDayMonths,
                ids = { UUID.fromString("b1000000-0000-4000-8000-%012x".format(++minted)) },
            ),
            choices = choices,
            recent = recent,
            emptyTheWorld = {
                val gone = world.events.size + world.characterEvents.size + world.structureEvents.size
                world.events.clear()
                world.characterEvents.clear()
                world.structureEvents.clear()
                structuresOnTheMap.reset()
                houses.reset()
                choices.reset()
                recent.reset()
                characters.reset()
                sights.reset()
                dialogueRows.reset()
                questRows.reset()
                gone
            },
            // A die that always comes up one, so every newcomer is the same known woman of eighteen.
            keyFigures = KeyFigureService(
                houses = world,
                characters = world,
                clock = { noon },
                world = worldClock,
                calendar = thirtyDayMonths,
                dice = { 1 },
                portraits = { listOf("woman-01", "man-01") },
            ),
            figures = characters,
            sights = sights,
            visions = VisionService(
                world,
                clock = { noon },
                world = worldClock,
                ids = { UUID.fromString("e1000000-0000-4000-8000-%012x".format(++minted)) },
            ),
            dialogues = DialogueService(world, characters, houses, clock = { noon }, world = worldClock),
            dialogueRows = dialogueRows,
            quests = QuestService(
                world,
                clock = { noon },
                world = worldClock,
                calendar = thirtyDayMonths,
                ids = { UUID.fromString("f1000000-0000-4000-8000-%012x".format(++minted)) },
                quests = questRows,
            ),
            questRows = questRows,
            stands = Stands { master, x, y -> if (master == "terrain") standsOnDisk[y * STAND_TILES + x] ?: ByteArray(0) else null },
            waters = WaterAt({ grounds[it] }, { names[it] }),
            structures = StructureService(world, houses, { noon }, worldClock, structuresOnTheMap, { UUID.randomUUID() }),
            antarctica = Antarctica(world, { RIG_CATALOGUE }, { noon }, worldClock),
            instrumentsOpen = instrumentsOpen,
            worldKept = worldKept,
            catalogues = catalogues,
        ),
        later = later,
        sendOn = sendOn,
    )

    /** The choice a player is holding, as the gateway would send it. */
    fun pending(token: String = TOKEN) = choices.pendingOf(PlayerId(UUID.fromString(token)))?.choice

    /**
     * A connection that has said hello, and everything it has been sent since. Every call uses the same
     * token unless told otherwise, so two of these are two windows of one player - which is exactly the
     * case worth testing, and now the case that ends in a takeover.
     *
     * `fogLifted` is Adam's switch pressed straight after. Most of what this spec asks is about cells and
     * deltas rather than the fog, and a window watching somebody else's house from nowhere near it would be
     * sent nothing, so those windows lift it; the fog has tests of its own.
     */
    fun introduced(
        token: String = TOKEN,
        fogLifted: Boolean = false,
        master: String? = null,
    ): Pair<Gateway.Connection, MutableList<ServerFrame>> {
        val sent = mutableListOf<ServerFrame>()
        val connection = gateway.connect { sent += it }
        val drawing = master?.let { ""","master":"$it"""" } ?: ""
        connection.receive("""{"type":"hello","playerToken":"$token","protocolVersion":$PROTOCOL_VERSION$drawing}""")
        if (fogLifted) {
            connection.receive(fogOfWar(false))
        }
        sent.clear()
        return connection to sent
    }

    /** Somebody else entirely: a fresh token, so this is another player rather than a takeover. */
    fun someoneElse(fogLifted: Boolean = false): Pair<Gateway.Connection, MutableList<ServerFrame>> =
        introduced(UUID.randomUUID().toString(), fogLifted)

    /**
     * Somebody else, whose socket starts closing once they have said hello and sent `first`: every frame sent
     * to them after that throws, the way Tomcat's send does between the close frame going out and the close
     * reaching the gateway. A seeding connection is one, because it closes the moment its command is accepted.
     */
    fun someoneLeaving(vararg first: String): Gateway.Connection {
        var closing = false
        val connection = gateway.connect {
            if (closing) throw IllegalStateException("the WebSocket session has been closed")
        }
        connection.receive("""{"type":"hello","playerToken":"${UUID.randomUUID()}","protocolVersion":$PROTOCOL_VERSION}""")
        first.forEach(connection::receive)
        closing = true
        return connection
    }

    /** A fresh player founds a house. Many houses means many players, one each; see decision 0028. */
    fun aHouseIsFounded(name: String = "Ravenscar") {
        val (someone, _) = someoneElse()
        someone.receive(founding(name = name))
    }
}
