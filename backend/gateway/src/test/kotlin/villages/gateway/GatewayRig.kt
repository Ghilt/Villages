package villages.gateway

import villages.application.Catalogues
import villages.application.Antarctica
import villages.application.QuestService
import villages.application.StructureService
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
import villages.application.fate.omenSources
import villages.application.fate.FateFromCatalogue
import villages.application.fate.RollService
import villages.application.WipeGate
import villages.application.WorldKept
import villages.application.WorldSaves
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
    saves: WorldSaves = WorldSaves.NOWHERE,
    /** Which windows the open instruments are open to, by sign-in: every one unless told. */
    instrumentsFor: ((villages.application.SignedIn?) -> Boolean)? = null,
    /** The world's settlements counted, as the opening would count them: none unless told. */
    settlements: () -> villages.protocol.SettlementsNow? = { null },
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
                names = { names[it] }, balance = { RIG_BALANCE },
            ),
            FateFromCatalogue({ RIG_FATE }, houses, { UUID.randomUUID() }) { RIG_BALANCE }, { 1 }, { UUID.randomUUID() },
            { RIG_BALANCE },
        ),
        houses, world, { noon }, worldClock, { UUID.randomUUID() }, { RIG_BALANCE },
    )
    var minted = 0

    /** The one master's stands, tile by tile, as the sprite map's folder would hold them. */
    val standsOnDisk = mutableMapOf<Int, ByteArray>()

    /** The one master's ruined towns, tile by tile, as `world:ruins` would write them. */
    val ruinsOnDisk = mutableMapOf<Int, ByteArray>()

    /** The one master's roads in pieces, tile by tile, as `world:roads` would write them. */
    val roadsOnDisk = mutableMapOf<Int, ByteArray>()

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

    /** Antarctica, which both the fog of the core and the structures' levers read: one of it. */
    private val antarctica = Antarctica(world, { RIG_CATALOGUE }, { noon }, worldClock)

    val gateway = Gateway(
        faults = faults,
        houses = houses,
        clock = Clock.fixed(noon, ZoneOffset.UTC),
        world = worldClock,
        onTheMap = characters,
        structures = structuresOnTheMap,
        mechanics = Mechanics(
            events = world,
            houseById = houses,
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
            stands = Stands { master, layer, x, y ->
                val tile = y * STAND_TILES + x
                when {
                    master != "terrain" -> null
                    layer == "biome" -> standsOnDisk[tile] ?: ByteArray(0)
                    layer == "ruins" -> ruinsOnDisk[tile] ?: ByteArray(0)
                    layer == "roads" -> roadsOnDisk[tile] ?: ByteArray(0)
                    else -> null
                }
            },
            waters = WaterAt({ grounds[it] }, { names[it] }),
            antarctica = antarctica,
            instrumentsOpen = instrumentsOpen,
            instrumentsFor = instrumentsFor,
            worldKept = worldKept,
            settlements = settlements,
            catalogues = catalogues,
            saves = saves,
            everyHouse = houses,
        ),
        later = later,
        sendOn = sendOn,
        own = listOf(
            HousesMechanic(houses, houses, FoundHouseService(world, clock = { noon }, world = worldClock)),
            // A die that always comes up one, so every newcomer is the same known woman of eighteen.
            KeyFiguresMechanic(
                characters,
                characters,
                KeyFigureService(
                    houses = world,
                    characters = world,
                    clock = { noon },
                    world = worldClock,
                    calendar = thirtyDayMonths,
                    dice = { 1 },
                    portraits = { listOf("woman-01", "man-01") },
                    balance = { RIG_BALANCE },
                    names = { RIG_NAMES },
                ),
            ),
            HoldingsMechanic(structuresOnTheMap, houses, { null }, { null }),
            StructuresMechanic(structuresOnTheMap, StructureService(world, houses, { noon }, worldClock, structuresOnTheMap, { UUID.randomUUID() }), antarctica),
            SightMechanic(
                sights,
                VisionService(
                    world,
                    clock = { noon },
                    world = worldClock,
                    ids = { UUID.fromString("e1000000-0000-4000-8000-%012x".format(++minted)) },
                ),
            ),
            ChoicesMechanic(
                Arrival(
                    world,
                    clock = { noon },
                    world = worldClock,
                    // Known ids rather than random ones, so a story can be named in an assertion.
                    ids = { UUID.fromString("a1000000-0000-4000-8000-%012x".format(++minted)) },
                ),
                TakeActionService(world, clock = { noon }, world = worldClock),
                choices,
                rolls,
            ),
            ResourcesMechanic(
                ResourceService(
                    world,
                    clock = { noon },
                    world = worldClock,
                    calendar = thirtyDayMonths,
                    ids = { UUID.fromString("b1000000-0000-4000-8000-%012x".format(++minted)) },
                ),
            ),
            DialoguesMechanic(DialogueService(world, characters, houses, clock = { noon }, world = worldClock) { mapOf("letter" to RIG_LETTER) }, dialogueRows),
            QuestsMechanic(
                QuestService(
                    world,
                    clock = { noon },
                    world = worldClock,
                    calendar = thirtyDayMonths,
                    ids = { UUID.fromString("f1000000-0000-4000-8000-%012x".format(++minted)) },
                    quests = questRows,
                ) { Catalogues(RIG_CATALOGUE, RIG_BALANCE, RIG_FATE, RIG_NAMES, ABBOT_DIALOGUES + ("letter" to RIG_LETTER), mapOf("abbot" to ABBOT)) },
                questRows,
            ),
            challengesInTheRig(),
        ),
    )

    /**
     * A window of the player of [token], signed in as them the way a browser's cookie signs its socket in at the
     * handshake, so its hello needs to name nobody.
     */
    fun connect(token: String = TOKEN, out: Outbound): Gateway.Connection = gateway.connect(signedInAs(token), out)

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
        val connection = connect(token) { sent += it }
        val drawing = master?.let { ""","master":"$it"""" } ?: ""
        connection.receive("""{"type":"hello","protocolVersion":$PROTOCOL_VERSION$drawing}""")
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
        val connection = connect(UUID.randomUUID().toString()) {
            if (closing) throw IllegalStateException("the WebSocket session has been closed")
        }
        connection.receive(hello)
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
