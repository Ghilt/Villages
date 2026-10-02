package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.string.shouldStartWith
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.ints.shouldBeLessThan
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.application.AnonymousTokens
import villages.application.Arrival
import villages.application.EventFeed
import villages.application.FeedFault
import villages.application.CharacterCommandExecutor
import villages.application.FoundHouseService
import villages.application.HouseCommandExecutor
import villages.application.KeyFigureService
import villages.application.Later
import villages.application.Provenance
import villages.application.ResourceService
import villages.application.Stands
import villages.application.Start
import villages.application.StoredEvent
import villages.application.TakeActionService
import villages.application.DialogueService
import villages.application.VisionService
import villages.application.WorldCalendar
import villages.application.WorldClock
import villages.application.WriteConflict
import villages.domain.CompleteDialogueStep
import villages.domain.FailRequirement
import villages.domain.Requirement
import villages.domain.CharacterId
import villages.domain.Effect
import villages.domain.GrantResource
import villages.domain.LineId
import villages.domain.CharacterCommand
import villages.domain.CharacterDecider
import villages.domain.CharacterEvent
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseEvent
import villages.domain.HouseFounded
import villages.domain.HouseGainedKeyFigure
import villages.domain.HouseGainedVision
import villages.domain.HouseLostKeyFigure
import villages.domain.HouseLostVision
import villages.domain.HouseResourceSpent
import villages.domain.HouseResourceReleased
import villages.domain.HouseResourcePledged
import villages.domain.HouseResourceGranted
import villages.domain.PlayerGivenChoice
import villages.domain.PlayerCompletedDialogue
import villages.domain.PlayerCompletedDialogueStep
import villages.domain.PlayerLostDialogue
import villages.domain.PlayerOfferedDialogue
import villages.domain.HouseId
import villages.domain.PlayerTookAction
import villages.domain.Resource
import villages.domain.PlayerId
import villages.domain.WorldTime
import villages.projections.CharactersProjection
import villages.projections.ChoicesProjection
import villages.projections.DialoguesProjection
import villages.projections.HousesProjection
import villages.projections.RecentEventsProjection
import villages.projections.SightProjection
import villages.protocol.Batch
import villages.protocol.Cell
import villages.protocol.CharacterArrived
import villages.protocol.CharacterChanged
import villages.protocol.CharacterGone
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.ErrorFrame
import villages.protocol.FoundAtView
import villages.protocol.RequirementView
import villages.protocol.RevealImpactView
import villages.protocol.EndingView
import villages.protocol.GrantView
import villages.protocol.ImpactView
import villages.protocol.SpendView
import villages.protocol.EventFrame
import villages.protocol.HouseAppeared
import villages.protocol.Point
import villages.protocol.Pong
import villages.protocol.ProtocolJson
import villages.protocol.Resync
import villages.protocol.ServerFrame
import villages.protocol.ShowsView
import villages.protocol.Snapshot
import villages.protocol.StandRecords
import villages.protocol.StandsFrame
import villages.protocol.TakenOver
import villages.protocol.VisionPointView
import villages.protocol.Welcome
import villages.protocol.WorldWiped
import villages.protocol.WorldNow
import villages.protocol.YourChoice
import villages.protocol.StatsView
import villages.protocol.YourHouse
import villages.protocol.YourDialogues
import villages.protocol.YourKeyFigures
import villages.protocol.YourSight
import villages.protocol.STAND_TILES
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.Base64
import java.util.UUID
import kotlin.math.PI
import kotlin.math.ln
import kotlin.math.roundToInt
import kotlin.math.tan

/**
 * A world small enough to hold in a test: one list of events, folded per stream, and a feed that delivers
 * synchronously. The gateway never knows the difference, which is the point of the ports.
 */
/** The catalogued type of an event, as the store would name it. */
private fun typeOf(event: HouseEvent): String = when (event) {
    is HouseFounded -> "villages.house.founded.v1"
    is HouseGainedKeyFigure -> "villages.house.gainedKeyFigure.v1"
    is HouseLostKeyFigure -> "villages.house.lostKeyFigure.v1"
    is HouseGainedVision -> "villages.house.gainedVision.v1"
    is HouseLostVision -> "villages.house.lostVision.v1"
    is HouseResourceGranted -> "villages.house.resourceGranted.v1"
    is HouseResourcePledged -> "villages.house.resourcePledged.v1"
    is HouseResourceReleased -> "villages.house.resourceReleased.v1"
    is HouseResourceSpent -> "villages.house.resourceSpent.v1"
    is PlayerGivenChoice -> "villages.player.givenChoice.v1"
    is PlayerOfferedDialogue -> "villages.player.offeredDialogue.v1"
    is PlayerCompletedDialogueStep -> "villages.player.completedDialogueStep.v1"
    is PlayerCompletedDialogue -> "villages.player.completedDialogue.v1"
    is PlayerLostDialogue -> "villages.player.lostDialogue.v1"
    is PlayerTookAction -> "villages.player.tookAction.v1"
}

/** Enough of the data for the panel's sake. The stored form proper is pinned by its own fixture. */
private fun dataOf(event: HouseEvent): String = when (event) {
    is HouseFounded -> """{"name":"${event.name.value}","significance":${event.significance.value}}"""
    is HouseGainedKeyFigure -> """{"characterId":"${event.characterId.value}"}"""
    is HouseLostKeyFigure -> """{"characterId":"${event.characterId.value}"}"""
    is HouseGainedVision -> """{"visionId":"${event.visionId.value}"}"""
    is HouseLostVision -> """{"visionId":"${event.visionId.value}"}"""
    is HouseResourceGranted -> """{"resource":"${event.resource}","amount":${event.amount}}"""
    is HouseResourcePledged -> """{"resource":"${event.resource}","amount":${event.amount}}"""
    is HouseResourceReleased -> """{"pledgeId":"${event.pledgeId.value}"}"""
    is HouseResourceSpent -> """{"resource":"${event.resource}","amount":${event.amount}}"""
    is PlayerGivenChoice -> """{"prompt":"${event.choice.prompt}","options":${event.choice.options.size}}"""
    is PlayerOfferedDialogue -> """{"title":"${event.dialogue.title}","lines":${event.dialogue.lines.size}}"""
    is PlayerCompletedDialogueStep -> """{"lineId":"${event.lineId.value}"}"""
    is PlayerCompletedDialogue -> """{"dialogueId":"${event.dialogueId.value}"}"""
    is PlayerLostDialogue -> """{"dialogueId":"${event.dialogueId.value}"}"""
    is PlayerTookAction -> """{"optionId":"${event.optionId.value}"}"""
}

/** A character's events, catalogued the same way; the panel's copy of their data is not what is tested here. */
private fun typeOf(event: CharacterEvent): String =
    "villages.character.${event::class.simpleName!!.removePrefix("Character").replaceFirstChar { it.lowercase() }}.v1"

private class TinyWorld : HouseCommandExecutor, CharacterCommandExecutor, EventFeed {
    val events = mutableListOf<HouseEvent>()
    val characterEvents = mutableListOf<CharacterEvent>()

    override fun execute(command: CharacterCommand, provenance: Provenance) {
        val stream = characterEvents.filter { it.characterId == command.characterId }
        val fresh = CharacterDecider.decide(command, CharacterDecider.fold(stream))
        characterEvents += fresh
        fresh.forEachIndexed { index, event ->
            val record = StoredEvent(
                id = "c-${characterEvents.size}-$index",
                type = typeOf(event),
                stream = event.characterId.stream,
                streamVersion = (stream.size + index + 1).toLong(),
                time = event.recordedAt,
                data = "{}",
                correlationId = provenance.correlationId.toString(),
                causationId = provenance.commandId.toString(),
                event = event,
            )
            this.stored += record
            subscribers.toList().forEach { it(record) }
        }
    }

    /** When set, every command loses the race for its stream, the way a contested one behaves. */
    var contested = false
    /** What has been stored, so a subscriber that wants the beginning can be given it. */
    private val stored = mutableListOf<StoredEvent>()
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun execute(command: HouseCommand, provenance: Provenance) {
        if (contested) {
            throw WriteConflict(command.houseId.stream, events.size.toLong())
        }
        val stream = events.filter { it.houseId == command.houseId }
        val fresh = HouseDecider.decide(command, HouseDecider.fold(stream))
        events += fresh
        fresh.forEachIndexed { index, event ->
            val record = StoredEvent(
                id = "e-${events.size}",
                type = typeOf(event),
                stream = event.houseId.stream,
                streamVersion = (stream.size + index + 1).toLong(),
                time = event.recordedAt,
                data = dataOf(event),
                correlationId = provenance.correlationId.toString(),
                causationId = provenance.commandId.toString(),
                event = event,
            )
            this.stored += record
            subscribers.toList().forEach { it(record) }
        }
    }

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        if (from == Start.FROM_THE_BEGINNING) {
            stored.forEach(subscriber)
        }
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    private val faultWatchers = mutableListOf<(FeedFault) -> Unit>()

    override fun watchFaults(listener: (FeedFault) -> Unit): AutoCloseable {
        faultWatchers += listener
        return AutoCloseable { faultWatchers -= listener }
    }

    /** What the real feed says when a subscriber throws, said on purpose. */
    fun fault(fault: FeedFault) = faultWatchers.toList().forEach { it(fault) }
}

/** Later is whenever the test says. */
/**
 * Thirty days a month, which is enough for a test about stepping. What a month really is belongs to
 * `villages.protocol.Calendar` and is held to the shared fixture there, not here.
 */
private val thirtyDayMonths = object : WorldCalendar {
    override fun plusMonths(day: WorldTime, months: Long) = WorldTime(day.day + months * 30)

    override fun monthsBetween(from: WorldTime, to: WorldTime) = (to.day - from.day) / 30
}

private class ManualLater : Later {
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

private val noon = Instant.parse("2026-09-04T12:00:00Z")

/** The twenty-fourth of June, year 1246: the world-day every test stands on. */
private val today = WorldTime(454901)
private const val TOKEN = "0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"
private val hello = """{"type":"hello","playerToken":"$TOKEN","protocolVersion":$PROTOCOL_VERSION}"""
private const val RAVENSCAR = "6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"

/** A command id is a UUID: it becomes the causation of what the command writes. See 0035. */
private const val COMMAND_ONE = "1c000001-0000-4000-8000-00000000000a"
private const val COMMAND_TWO = "1c000002-0000-4000-8000-00000000000b"
private const val COMMAND_THREE = "1c000003-0000-4000-8000-00000000000c"
private const val COMMAND_FOUR = "1c000004-0000-4000-8000-00000000000d"

/** Stockholm, before the warp, at three depths: the shared vector every zoom of it is known for. */
private const val STOCKHOLM_Z10 = "1200312213"
private const val STOCKHOLM_Z8 = "12003122"
private const val STOCKHOLM_Z4 = "1200"

/** Four hundred kilometres east of Stockholm, and the cell it falls in: far outside a seat there's 34 km. */
private const val HELSINKI_LAT = 60.17
private const val HELSINKI_LON = 24.94
private val HELSINKI_Z10 = Cell.of(HELSINKI_LAT, HELSINKI_LON).quadkey

private fun founding(
    commandId: String = COMMAND_ONE,
    name: String = "Ravenscar",
    lat: Double = 59.33,
    lon: Double = 18.07,
) =
    """{"type":"command","commandId":"$commandId","command":{"type":"foundHouse",""" +
        """"name":"$name","seat":{"lat":$lat,"lon":$lon},""" +
        """"banner":{"field":"sable","division":"plain","charge":"stag","chargeTincture":"argent"}}}"""

private fun takingAction(choiceId: String, optionId: String, commandId: String = COMMAND_ONE) =
    """{"type":"command","commandId":"$commandId","command":{"type":"takeAction",""" +
        """"choiceId":"$choiceId","optionId":"$optionId"}}"""

private fun granting(resource: String = "wealth", amount: Long = 120, commandId: String = COMMAND_TWO) =
    """{"type":"command","commandId":"$commandId","command":{"type":"grantResource",""" +
        """"resource":"$resource","amount":$amount}}"""

private fun spending(resource: String = "wealth", amount: Long = 50, commandId: String = COMMAND_TWO) =
    """{"type":"command","commandId":"$commandId","command":{"type":"spendResource",""" +
        """"resource":"$resource","amount":$amount}}"""

private fun pledging(resource: String = "reason", amount: Long = 35, months: Long = 10, commandId: String = COMMAND_TWO) =
    """{"type":"command","commandId":"$commandId","command":{"type":"pledgeResource",""" +
        """"resource":"$resource","amount":$amount,"months":$months,"purpose":"clearer glass"}}"""

private fun releasing(pledgeId: String, commandId: String = COMMAND_TWO) =
    """{"type":"command","commandId":"$commandId","command":{"type":"releasePledge",""" +
        """"pledgeId":"$pledgeId"}}"""

private fun subscribe(vararg cells: String) =
    """{"type":"subscribeCells","cells":[${cells.joinToString { "\"$it\"" }}]}"""

private fun unsubscribe(vararg cells: String) =
    """{"type":"unsubscribeCells","cells":[${cells.joinToString { "\"$it\"" }}]}"""

private fun seeAll(on: Boolean) = """{"type":"seeAll","on":$on}"""

private fun fogOfWar(on: Boolean) = """{"type":"fogOfWar","on":$on}"""

private fun offering(sample: String, commandId: String) =
    """{"type":"command","commandId":"$commandId","command":{"type":"offerDialogue","sample":"$sample"}}"""

private fun stepping(dialogueId: String, lineId: String, commandId: String) =
    """{"type":"command","commandId":"$commandId",""" +
        """"command":{"type":"completeDialogueStep","dialogueId":"$dialogueId","lineId":"$lineId"}}"""

private fun addingAKeyFigure(commandId: String) =
    """{"type":"command","commandId":"$commandId","command":{"type":"addKeyFigure"}}"""

private fun changingStat(characterId: String, stat: String, by: Int, commandId: String) =
    """{"type":"command","commandId":"$commandId","command":{"type":"changeStat",""" +
        """"characterId":"$characterId","stat":"$stat","by":$by}}"""

private fun killing(characterId: String, commandId: String) =
    """{"type":"command","commandId":"$commandId","command":{"type":"killCharacter",""" +
        """"characterId":"$characterId","cause":"struck down from the debug panel"}}"""

private fun moving(characterId: String, lat: Double, lon: Double, commandId: String) =
    """{"type":"command","commandId":"$commandId","command":{"type":"moveCharacter",""" +
        """"characterId":"$characterId","place":{"lat":$lat,"lon":$lon}}}"""

private fun givingVision(lat: Double, lon: Double, commandId: String) =
    """{"type":"command","commandId":"$commandId","command":{"type":"giveVision",""" +
        """"place":{"lat":$lat,"lon":$lon}}}"""

private fun takingVision(visionId: String, commandId: String) =
    """{"type":"command","commandId":"$commandId","command":{"type":"takeVision",""" +
        """"visionId":"$visionId"}}"""

private fun takingOff(characterId: String, commandId: String) =
    """{"type":"command","commandId":"$commandId","command":{"type":"takeOffTheMap",""" +
        """"characterId":"$characterId"}}"""

/** How far across the scenery's world a place is, in world units: the Mercator square, 32768 a side. */
private fun worldX(lon: Double): Double = (lon + 180.0) / 360.0 * 32768.0

/** How far down the scenery's world a place is, in world units. */
private fun worldY(lat: Double): Double = (0.5 - ln(tan(PI / 4.0 + lat * PI / 360.0)) / (2.0 * PI)) * 32768.0

/** The zoom 7 tile Stockholm is in, 70 across and 37 down, and one stand there as the sprite map writes it. */
private const val STOCKHOLM_TILE = 37 * STAND_TILES + 70

private fun stockholmStand(eastOfTheSeat: Double, reach: Double): ByteArray {
    val across = ((worldX(18.07) + eastOfTheSeat - 70 * 256) * 8).roundToInt()
    val down = ((worldY(59.33) - 37 * 256) * 8).roundToInt()
    return byteArrayOf(
        across.toByte(), (across shr 8).toByte(), down.toByte(), (down shr 8).toByte(), (reach * 4).roundToInt().toByte(),
        0, 40, 7,
    )
}

/** At the seat; just outside its circle, near enough to count; and a hundred units off, too far for its reach. */
private val atTheSeat = stockholmStand(0.0, 6.0)
private val justOutside = stockholmStand(60.0, 2.0)
private val farOff = stockholmStand(100.0, 6.0)

/** The records a stands frame carries, as bytes to compare. */
private fun recordsOf(frame: StandsFrame): List<Byte> = Base64.getDecoder().decode(frame.stands).toList()

/** A command id of its own for every command a test sends, since a key figure's id is worked out from one. */
private fun commandNumber(n: Int) = "c0000000-0000-4000-8000-%012d".format(n)

private class Rig {
    val world = TinyWorld()
    val later = ManualLater()
    val houses = HousesProjection(world)
    val choices = ChoicesProjection(world)
    val recent = RecentEventsProjection(world)
    val characters = CharactersProjection(world)
    val sights = SightProjection(world)
    val dialogueRows = DialoguesProjection(world)
    val worldClock = WorldClock { today }
    var minted = 0

    /** The one master's stands, tile by tile, as the sprite map's folder would hold them. */
    val standsOnDisk = mutableMapOf<Int, ByteArray>()

    val gateway = Gateway(
        tokens = AnonymousTokens,
        foundHouse = FoundHouseService(world, clock = { noon }, world = worldClock),
        events = world,
        houses = houses,
        theirHouses = houses,
        clock = Clock.fixed(noon, ZoneOffset.UTC),
        world = worldClock,
        arrival = Arrival(
            world,
            clock = { noon },
            world = worldClock,
            // Known ids rather than random ones, so a story can be named in an assertion.
            ids = { UUID.fromString("a1000000-0000-4000-8000-%012x".format(++minted)) },
        ),
        takeAction = TakeActionService(world, clock = { noon }, world = worldClock),
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
            val gone = world.events.size + world.characterEvents.size
            world.events.clear()
            world.characterEvents.clear()
            houses.reset()
            choices.reset()
            recent.reset()
            characters.reset()
            sights.reset()
            dialogueRows.reset()
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
        onTheMap = characters,
        sights = sights,
        visions = VisionService(
            world,
            clock = { noon },
            world = worldClock,
            ids = { UUID.fromString("e1000000-0000-4000-8000-%012x".format(++minted)) },
        ),
        dialogues = DialogueService(world, characters, houses, clock = { noon }, world = worldClock),
        dialogueRows = dialogueRows,
        stands = Stands { master, x, y -> if (master == "terrain") standsOnDisk[y * STAND_TILES + x] ?: ByteArray(0) else null },
        later = later,
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

class GatewaySpec : StringSpec({

    "hello is answered with welcome, the house this player has, and the choice they have to make" {
        val sent = mutableListOf<ServerFrame>()
        Rig().gateway.connect { sent += it }.receive(hello)

        sent.take(2) shouldBe listOf(
            Welcome(
                serverTime = noon.toEpochMilli(),
                playerId = TOKEN,
                world = WorldNow(today = today.day, earliest = today.day),
            ),
            YourHouse(null),
        )
        // Arriving with no house is what the founding choice answers, and it is said exactly once.
        sent.filterIsInstance<YourChoice>().single().choice?.prompt shouldBe
            "Where shall the house raise its seat?"
    }

    "hello also says which key figures the house holds, which is none before it holds any" {
        val sent = mutableListOf<ServerFrame>()
        Rig().gateway.connect { sent += it }.receive(hello)

        sent[2] shouldBe YourKeyFigures(emptyList())
    }

    "hello also says what the house sees from, which is nowhere before there is a house" {
        val sent = mutableListOf<ServerFrame>()
        Rig().gateway.connect { sent += it }.receive(hello)

        sent[3] shouldBe YourSight(emptyList(), tension = 40.0)
    }

    "a founded house sees from its seat, as big a circle as Mallorca, and its player is told" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()

        mine.receive(founding())

        sent.filterIsInstance<YourSight>().last() shouldBe YourSight(
            listOf(VisionPointView(kind = "seat", place = Point(59.33, 18.07), radius = 34.0, since = today.day)),
            tension = 40.0,
        )
    }

    "a key figure put on the map gives vision there, and moving them closes that point and opens the next" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id

        mine.receive(moving(agnes, 59.86, 17.64, commandNumber(2)))
        mine.receive(moving(agnes, 57.64, 18.30, commandNumber(3)))

        sent.filterIsInstance<YourSight>().last().points shouldBe listOf(
            VisionPointView(kind = "seat", place = Point(59.33, 18.07), radius = 34.0, since = today.day),
            VisionPointView("keyFigure", agnes, Point(59.86, 17.64), 34.0, since = today.day, until = today.day),
            VisionPointView("keyFigure", agnes, Point(57.64, 18.30), 34.0, since = today.day),
        )
    }

    "vision given outright is a vision point of its own, and taking it away closes it" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())

        mine.receive(givingVision(57.64, 18.30, commandNumber(1)))
        val given = sent.filterIsInstance<YourSight>().last().points.last()
        given.kind shouldBe "given"
        given.place shouldBe Point(57.64, 18.30)
        given.radius shouldBe 34.0
        given.until shouldBe null

        mine.receive(takingVision(given.of!!, commandNumber(2)))
        sent.filterIsInstance<CommandAccepted>().map { it.commandId } shouldContain commandNumber(2)
        sent.filterIsInstance<YourSight>().last().points.last() shouldBe given.copy(until = today.day)
    }

    "a vision the house was never given cannot be taken away" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())

        mine.receive(takingVision("dd000000-0000-4000-8000-000000000099", commandNumber(1)))

        sent.filterIsInstance<CommandRejected>().single() shouldBe CommandRejected(commandNumber(1), "noSuchVision")
    }

    "what one house sees is told to its own player and to nobody else" {
        val rig = Rig()
        val (looker, seen) = rig.someoneElse()
        val (mine, _) = rig.introduced()

        mine.receive(founding())

        seen.filterIsInstance<YourSight>().shouldBeEmpty()
        looker.cells().shouldBeEmpty()
    }

    "the fog holds back a house on ground the player's house has never seen, and lifting it sends it" {
        val rig = Rig()
        val (theirs, _) = rig.someoneElse()
        theirs.receive(founding(name = "Kestrel", lat = HELSINKI_LAT, lon = HELSINKI_LON))
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        sent.clear()

        mine.receive(subscribe(HELSINKI_Z10, STOCKHOLM_Z10))

        val fogged = sent.filterIsInstance<Snapshot>().associateBy { it.cell }
        fogged.getValue(HELSINKI_Z10).houses.shouldBeEmpty()
        // What is hidden is not counted either, because how much is hidden is itself something learnt.
        fogged.getValue(HELSINKI_Z10).omitted shouldBe 0
        fogged.getValue(STOCKHOLM_Z10).houses.single().name shouldBe "Ravenscar"
        sent.clear()

        mine.receive(fogOfWar(false))
        sent.filterIsInstance<Snapshot>().single { it.cell == HELSINKI_Z10 }.houses.single().name shouldBe "Kestrel"
        sent.clear()

        mine.receive(fogOfWar(false))
        sent.shouldBeEmpty()

        mine.receive(fogOfWar(true))
        sent.filterIsInstance<Snapshot>().single { it.cell == HELSINKI_Z10 }.houses.shouldBeEmpty()
    }

    "a house arrives with the vision given over it, before which the page is told the new sight, and stays once it is taken away" {
        val rig = Rig()
        val (theirs, _) = rig.someoneElse()
        theirs.receive(founding(name = "Kestrel", lat = HELSINKI_LAT, lon = HELSINKI_LON))
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(subscribe(HELSINKI_Z10))
        sent.clear()

        mine.receive(givingVision(HELSINKI_LAT, HELSINKI_LON, commandNumber(1)))

        sent.filterIsInstance<Snapshot>().single().houses.single().name shouldBe "Kestrel"
        sent.indexOfFirst { it is YourSight } shouldBeLessThan sent.indexOfFirst { it is Snapshot }
        val given = sent.filterIsInstance<YourSight>().last().points.last().of!!
        sent.clear()

        mine.receive(takingVision(given, commandNumber(2)))

        // Revealed ground keeps its buildings: what stands still is still known.
        sent.filterIsInstance<Snapshot>().single().houses.single().name shouldBe "Kestrel"
    }

    "somebody is sent only while they stand in vision, and not on ground that is only revealed" {
        val rig = Rig()
        val (theirs, told) = rig.someoneElse()
        theirs.receive(founding(name = "Kestrel", lat = HELSINKI_LAT, lon = HELSINKI_LON))
        theirs.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = told.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        theirs.receive(moving(agnes, HELSINKI_LAT, HELSINKI_LON, commandNumber(2)))
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(givingVision(HELSINKI_LAT, HELSINKI_LON, commandNumber(3)))
        val given = sent.filterIsInstance<YourSight>().last().points.last().of!!
        sent.clear()

        mine.receive(subscribe(HELSINKI_Z10))
        sent.filterIsInstance<Snapshot>().single().characters.single().id shouldBe agnes
        sent.clear()

        mine.receive(takingVision(given, commandNumber(4)))

        val revealed = sent.filterIsInstance<Snapshot>().single()
        revealed.houses.single().name shouldBe "Kestrel"
        revealed.characters.shouldBeEmpty()
        revealed.omittedCharacters shouldBe 0
    }

    "a founding on ground the player has never seen is not told to them, and one in their vision is" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(subscribe(HELSINKI_Z10, STOCKHOLM_Z10))
        rig.later.tick()
        sent.clear()

        rig.someoneElse().first.receive(founding(name = "Kestrel", lat = HELSINKI_LAT, lon = HELSINKI_LON))
        rig.someoneElse().first.receive(founding(name = "Wren", lat = 59.34, lon = 18.06))
        rig.later.tick()

        sent.filterIsInstance<Batch>().flatMap { it.deltas }
            .map { it.shouldBeInstanceOf<HouseAppeared>().house.name } shouldBe listOf("Wren")
    }

    "somebody walking into the house's vision arrives, and walking out of it is gone" {
        val rig = Rig()
        val (theirs, told) = rig.someoneElse()
        theirs.receive(founding(name = "Kestrel", lat = HELSINKI_LAT, lon = HELSINKI_LON))
        theirs.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = told.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(subscribe(STOCKHOLM_Z10, HELSINKI_Z10))
        rig.later.tick()
        sent.clear()

        // Standing in a cell the player holds, on ground their house has never seen.
        theirs.receive(moving(agnes, HELSINKI_LAT, HELSINKI_LON, commandNumber(2)))
        rig.later.tick()
        sent.filterIsInstance<Batch>().flatMap { it.deltas }.shouldBeEmpty()

        theirs.receive(moving(agnes, 59.34, 18.06, commandNumber(3)))
        rig.later.tick()
        sent.filterIsInstance<Batch>().single().deltas.single()
            .shouldBeInstanceOf<CharacterArrived>().character.id shouldBe agnes
        sent.clear()

        theirs.receive(moving(agnes, HELSINKI_LAT, HELSINKI_LON, commandNumber(4)))
        rig.later.tick()
        sent.filterIsInstance<Batch>().single().deltas.single().shouldBeInstanceOf<CharacterGone>().id shouldBe agnes
    }

    "a player's own key figure reaches them wherever they walk, without waiting for the sight to follow" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        mine.receive(subscribe(HELSINKI_Z10))
        rig.later.tick()
        sent.clear()

        mine.receive(moving(agnes, HELSINKI_LAT, HELSINKI_LON, commandNumber(2)))
        rig.later.tick()

        // As a delta, and not only in the cell answered again once the sight has caught up with her.
        sent.filterIsInstance<Batch>().single().deltas.single()
            .shouldBeInstanceOf<CharacterArrived>().character.id shouldBe agnes
    }

    "a house takes a key figure in, and its player is told who they are, stats and all" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        sent.clear()

        mine.receive(addingAKeyFigure(commandNumber(1)))

        sent.filterIsInstance<CommandAccepted>().single().commandId shouldBe commandNumber(1)
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single()
        agnes.givenName shouldBe "Agnes"
        agnes.familyName shouldBe "Achterberg"
        agnes.sex shouldBe "woman"
        agnes.species shouldBe "person"
        agnes.stats shouldBe StatsView(piety = 3, reason = 3, kindness = 3, physical = 3)
        agnes.portrait shouldBe "woman-01"
        agnes.keyFigureOf.single().name shouldBe "Ravenscar"
    }

    "a lever on one of the house's own key figures changes what its player is told" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id

        mine.receive(changingStat(agnes, "piety", 2, commandNumber(2)))

        sent.filterIsInstance<CommandAccepted>().last().commandId shouldBe commandNumber(2)
        sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().stats.piety shouldBe 5
    }

    "a lever on somebody else's key figure is refused as not one of the house's own" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        val (theirs, told) = rig.someoneElse()
        theirs.receive(founding(name = "Hollin"))

        theirs.receive(changingStat(agnes, "piety", 2, commandNumber(2)))

        told.filterIsInstance<CommandRejected>().single().reason shouldBe "noSuchKeyFigure"
        sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().stats.piety shouldBe 3
    }

    "a stat the wire does not know is refused as malformed" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id

        mine.receive(changingStat(agnes, "luck", 2, commandNumber(2)))

        sent.filterIsInstance<CommandRejected>().single().reason shouldBe "malformed: not a stat: luck"
    }

    "a key figure killed leaves the list at once" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id

        mine.receive(killing(agnes, commandNumber(2)))

        sent.filterIsInstance<CommandAccepted>().last().commandId shouldBe commandNumber(2)
        sent.filterIsInstance<YourKeyFigures>().last().keyFigures.shouldBeEmpty()
    }

    "a key figure moved onto the map arrives for whoever holds their cell, and their player is told where" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        val (looker, seen) = rig.someoneElse(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z10))
        val (far, farSeen) = rig.someoneElse(fogLifted = true)
        // Zoom 8 is coarser than a key figure's significance is drawn at, which is zoom 9.
        far.receive(subscribe(STOCKHOLM_Z8))
        rig.later.tick()
        seen.clear()
        farSeen.clear()

        mine.receive(moving(agnes, 59.34, 18.06, commandNumber(2)))
        rig.later.tick()

        sent.filterIsInstance<CommandAccepted>().last().commandId shouldBe commandNumber(2)
        sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().place shouldBe Point(59.34, 18.06)
        val arrived = seen.filterIsInstance<Batch>().single().deltas.single().shouldBeInstanceOf<CharacterArrived>()
        arrived.character.givenName shouldBe "Agnes"
        arrived.character.cell shouldBe STOCKHOLM_Z10
        arrived.character.keyFigureOf.single().name shouldBe "Ravenscar"
        farSeen.filterIsInstance<Batch>().flatMap { it.deltas }.shouldBeEmpty()
    }

    // A house never moves, so a client never had to drop one; a character does, and has to be told.
    "a character moving within the cells held is changed, and moving out of them is gone" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        val (looker, seen) = rig.someoneElse(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z10))
        mine.receive(moving(agnes, 59.34, 18.06, commandNumber(2)))
        rig.later.tick()
        seen.clear()

        mine.receive(moving(agnes, 59.335, 18.065, commandNumber(3)))
        rig.later.tick()
        seen.filterIsInstance<Batch>().single().deltas.single().shouldBeInstanceOf<CharacterChanged>()
        seen.clear()

        mine.receive(moving(agnes, 60.17, 24.94, commandNumber(4)))
        rig.later.tick()
        seen.filterIsInstance<Batch>().single().deltas.single().shouldBeInstanceOf<CharacterGone>().id shouldBe agnes
    }

    "taking a key figure off the map is gone for whoever held them, and a stat change tells the map nothing" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        val (looker, seen) = rig.someoneElse(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z10))
        mine.receive(moving(agnes, 59.34, 18.06, commandNumber(2)))
        rig.later.tick()
        seen.clear()

        mine.receive(changingStat(agnes, "piety", 2, commandNumber(3)))
        rig.later.tick()
        seen.shouldBeEmpty()

        mine.receive(takingOff(agnes, commandNumber(4)))
        rig.later.tick()
        seen.filterIsInstance<Batch>().single().deltas.single().shouldBeInstanceOf<CharacterGone>()
        sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().place shouldBe null
    }

    "a cell's snapshot carries the characters standing in it" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        mine.receive(moving(agnes, 59.34, 18.06, commandNumber(2)))
        val (looker, seen) = rig.someoneElse(fogLifted = true)

        looker.receive(subscribe(STOCKHOLM_Z10))

        val snapshot = seen.filterIsInstance<Snapshot>().single()
        snapshot.characters.single().id shouldBe agnes
        snapshot.characters.single().place shouldBe Point(59.34, 18.06)
        snapshot.omittedCharacters shouldBe 0
    }

    "moving somebody else's key figure is refused, and so is a place off the world" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        val (theirs, told) = rig.someoneElse()
        theirs.receive(founding(name = "Hollin"))

        theirs.receive(moving(agnes, 59.34, 18.06, commandNumber(2)))
        mine.receive(moving(agnes, 95.0, 18.06, commandNumber(3)))
        mine.receive(takingOff(agnes, commandNumber(4)))

        told.filterIsInstance<CommandRejected>().single().reason shouldBe "noSuchKeyFigure"
        sent.filterIsInstance<CommandRejected>().map { it.reason } shouldBe listOf("invalidLocation", "notOnTheMap")
    }

    "a tenth key figure is refused, because a house holds nine" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        (1..9).forEach { mine.receive(addingAKeyFigure(commandNumber(it))) }

        mine.receive(addingAKeyFigure(commandNumber(10)))

        sent.filterIsInstance<CommandRejected>().single().reason shouldBe "tooManyKeyFigures"
        sent.filterIsInstance<YourKeyFigures>().last().keyFigures shouldHaveSize 9
    }

    "and that choice offers three seats, in three different parts of the world" {
        val sent = mutableListOf<ServerFrame>()
        Rig().gateway.connect { sent += it }.receive(hello)

        val choice = sent.filterIsInstance<YourChoice>().single().choice!!
        choice.options shouldHaveSize 3
        // Each option is a destiny: a place, a name and a banner of its own.
        choice.options.map { it.effect.shouldBeInstanceOf<FoundAtView>().name }.distinct() shouldHaveSize 3
        choice.options.map { it.label.substringAfter(", in ") }.distinct() shouldHaveSize 3
    }

    "a player who already has a house is given nothing to decide" {
        val rig = Rig()
        val (founder, _) = rig.introduced()
        founder.receive(founding())
        founder.disconnected()
        val sent = mutableListOf<ServerFrame>()

        rig.gateway.connect { sent += it }.receive(hello)

        sent.filterIsInstance<YourChoice>().single().choice shouldBe null
    }

    "a player who already has a house is told which on hello, before looking at anything" {
        val rig = Rig()
        // The same player, coming back: a fresh window, and the house is still theirs.
        val (founder, _) = rig.introduced()
        founder.receive(founding())
        founder.disconnected()
        val sent = mutableListOf<ServerFrame>()

        rig.gateway.connect { sent += it }.receive(hello)

        val mine = sent.filterIsInstance<YourHouse>().last().yours?.house
        mine?.name shouldBe "Ravenscar"
        mine?.cell shouldBe STOCKHOLM_Z10
    }

    "what a house has reaches its owner, and reaches nobody else" {
        val rig = Rig()
        val (founder, mine) = rig.introduced()
        val (neighbour, theirs) = rig.someoneElse(fogLifted = true)
        neighbour.receive(subscribe(STOCKHOLM_Z10))
        theirs.clear()

        founder.receive(founding())
        // The neighbour's deltas are coalesced, so nothing reaches them until the flush comes due.
        rig.later.tick()

        // The owner is told all five, under their wire names, which are the code's and not the player's.
        val yours = mine.filterIsInstance<YourHouse>().last().yours!!
        yours.resources.keys shouldContainExactlyInAnyOrder
            setOf("wealth", "naturalDomain", "influence", "reason", "piety")
        yours.resources.getValue("wealth").total shouldBe 0
        yours.resources.getValue("wealth").pledged shouldBe 0
        yours.pledges.shouldBeEmpty()

        // The neighbour holding the cell sees the house arrive and is told nothing of what it has. A
        // `yourHouse` is only ever about your own, and the public view has nowhere to carry a resource,
        // so the privacy is the shape rather than a rule anybody has to remember. See decision 0028.
        theirs.filterIsInstance<YourHouse>().shouldBeEmpty()
        theirs.filterIsInstance<Batch>().flatMap { it.deltas }.shouldNotBeEmpty()
    }

    "a granted resource comes back on the owner's own house, and a spend takes it off again" {
        val rig = Rig()
        val (founder, mine) = rig.introduced()
        founder.receive(founding())

        founder.receive(granting(amount = 120))

        mine.filterIsInstance<CommandAccepted>().map { it.commandId } shouldContain COMMAND_TWO
        mine.filterIsInstance<YourHouse>().last().yours!!.resources.getValue("wealth").total shouldBe 120

        founder.receive(spending(amount = 50, commandId = COMMAND_THREE))

        mine.filterIsInstance<YourHouse>().last().yours!!.resources.getValue("wealth").total shouldBe 70
    }

    "a pledge is asked for in months and comes back as a day, held against what is free" {
        val rig = Rig()
        val (founder, mine) = rig.introduced()
        founder.receive(founding())
        founder.receive(granting(resource = "reason", amount = 100))

        founder.receive(pledging(amount = 35, months = 10, commandId = COMMAND_THREE))

        val yours = mine.filterIsInstance<YourHouse>().last().yours!!
        yours.resources.getValue("reason").total shouldBe 100
        yours.resources.getValue("reason").pledged shouldBe 35
        val pledge = yours.pledges.single()
        pledge.amount shouldBe 35
        pledge.purpose shouldBe "clearer glass"
        // Ten months on, by the calendar this rig was given. What a month is belongs to the calendar.
        pledge.until shouldBe today.day + 300

        founder.receive(releasing(pledge.id, commandId = COMMAND_FOUR))

        val freed = mine.filterIsInstance<YourHouse>().last().yours!!
        freed.pledges.shouldBeEmpty()
        freed.resources.getValue("reason").pledged shouldBe 0
    }

    "a resource nobody has heard of is refused as malformed rather than guessed at" {
        val rig = Rig()
        val (founder, mine) = rig.introduced()
        founder.receive(founding())

        founder.receive(granting(resource = "domain", amount = 5, commandId = COMMAND_TWO))

        // `domain` is the player's word; the wire's is `naturalDomain`, and the gateway does not translate.
        mine.filterIsInstance<CommandRejected>().single().reason shouldStartWith "malformed"
    }

    "spending more than is free is refused, and says so" {
        val rig = Rig()
        val (founder, mine) = rig.introduced()
        founder.receive(founding())

        founder.receive(spending(amount = 1, commandId = COMMAND_TWO))

        mine.filterIsInstance<CommandRejected>().single().reason shouldBe "notEnoughFree"
    }

    "welcome's earliest day is the first anything is known to exist from" {
        val rig = Rig()
        rig.aHouseIsFounded()
        val sent = mutableListOf<ServerFrame>()

        rig.gateway.connect { sent += it }.receive(hello)

        sent.first().shouldBeInstanceOf<Welcome>().world shouldBe WorldNow(today = today.day, earliest = today.day)
    }

    "looking at a day before a house was founded, its cell is empty; looking at live again, it is back" {
        val rig = Rig()
        val (founder, _) = rig.someoneElse()
        founder.receive(founding())
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z8))
        sent.single().shouldBeInstanceOf<Snapshot>().houses shouldHaveSize 1
        sent.clear()

        looker.receive("""{"type":"viewTime","at":${today.day - 1}}""")
        sent.single().shouldBeInstanceOf<Snapshot>().houses.shouldBeEmpty()
        sent.clear()

        looker.receive("""{"type":"viewTime","at":null}""")
        val back = sent.single().shouldBeInstanceOf<Snapshot>()
        back.houses shouldHaveSize 1
        back.houses.single().since shouldBe today.day
    }

    "a connection looking at the past is not told of a founding on a later day" {
        val rig = Rig()
        val (looker, sent) = rig.introduced()
        looker.receive(subscribe(STOCKHOLM_Z8))
        looker.receive("""{"type":"viewTime","at":${today.day - 100}}""")
        sent.clear()
        val (founder, _) = rig.someoneElse()

        founder.receive(founding())
        rig.later.tick()

        sent.shouldBeEmpty()
    }

    "a day before the calendar began is refused" {
        val (looker, sent) = Rig().introduced()

        looker.receive("""{"type":"viewTime","at":-5}""")

        sent.single().shouldBeInstanceOf<ErrorFrame>().code shouldBe "badTime"
    }

    "a client of another protocol version, or with no token, is told so and not welcomed" {
        val sent = mutableListOf<ServerFrame>()
        val connection = Rig().gateway.connect { sent += it }

        connection.receive("""{"type":"hello","playerToken":"$TOKEN","protocolVersion":${PROTOCOL_VERSION + 1}}""")
        connection.receive("""{"type":"hello","playerToken":"nope","protocolVersion":$PROTOCOL_VERSION}""")
        connection.receive("this is not json")

        sent.map { it.shouldBeInstanceOf<ErrorFrame>().code } shouldBe listOf("protocolVersion", "playerToken", "unreadable")
    }

    "a founding command is accepted, and the event reaches everyone watching" {
        val rig = Rig()
        val (founding, founder) = rig.introduced()
        val (watching, watcher) = rig.someoneElse()
        val (_, bystander) = rig.someoneElse()
        watching.receive("""{"type":"watchEvents","on":true}""")

        founding.receive(founding())

        founder.last() shouldBe CommandAccepted(COMMAND_ONE)
        rig.world.events.filterIsInstance<HouseFounded>() shouldHaveSize 1
        val event = watcher.last().shouldBeInstanceOf<EventFrame>()
        event.eventType shouldBe "villages.house.founded.v1"
        // The house is the player's own, worked out from the token rather than chosen by the browser.
        event.stream shouldBe HouseId.of(PlayerId(UUID.fromString(TOKEN))).stream
        // Second on the stream: arriving wrote the founding choice before this founded anything.
        event.streamVersion shouldBe 2
        event.time shouldBe noon.toEpochMilli()
        event.data.get("significance").asDouble() shouldBe 20.0
        bystander.shouldBeEmpty()
    }

    "a watcher is given what it missed, oldest first, and then what happens next" {
        val rig = Rig()
        val (founder, _) = rig.someoneElse()
        founder.receive(founding())

        // Only now does anyone start watching: everything above happened before this window existed.
        val (watching, watcher) = rig.someoneElse()
        watching.receive("""{"type":"watchEvents","on":true}""")

        // The founder arriving, the founder founding, and the watcher arriving: all before this asked.
        val missed = watcher.filterIsInstance<EventFrame>().map { it.eventType }
        missed shouldBe listOf(
            "villages.player.givenChoice.v1",
            "villages.house.founded.v1",
            "villages.player.givenChoice.v1",
        )

        // And it keeps hearing them as they happen.
        watcher.clear()
        rig.aHouseIsFounded()
        watcher.filterIsInstance<EventFrame>().map { it.eventType } shouldBe listOf(
            "villages.player.givenChoice.v1",
            "villages.house.founded.v1",
        )
    }

    "and one that stops watching is given nothing more" {
        val rig = Rig()
        val (watching, watcher) = rig.introduced()
        watching.receive("""{"type":"watchEvents","on":true}""")
        watching.receive("""{"type":"watchEvents","on":false}""")
        watcher.clear()

        rig.aHouseIsFounded()

        watcher.filterIsInstance<EventFrame>().shouldBeEmpty()
    }

    "the event says which command caused it, and which story it belongs to" {
        val rig = Rig()
        val (founder, _) = rig.introduced()
        val (watching, watcher) = rig.someoneElse()
        watching.receive("""{"type":"watchEvents","on":true}""")

        founder.receive(founding())

        val event = watcher.last().shouldBeInstanceOf<EventFrame>()
        // A founding starts a story of its own, so both ids are the command's. Decision record 0035.
        event.causationId shouldBe COMMAND_ONE
        event.correlationId shouldBe COMMAND_ONE
    }

    "a command whose id is not a UUID is refused before it is decided" {
        val rig = Rig()
        val (connection, sent) = rig.introduced()

        connection.receive(founding(commandId = "c-1"))

        sent.single() shouldBe CommandRejected("c-1", "malformed: a command id is a UUID")
        rig.world.events.filterIsInstance<HouseFounded>().shouldBeEmpty()
    }

    "a stream that will not stand still is a conflict, which is not a refusal" {
        val rig = Rig()
        rig.world.contested = true
        val (connection, sent) = rig.introduced()

        connection.receive(founding())

        sent.last() shouldBe CommandRejected(COMMAND_ONE, "conflict")
    }

    "the founder is told which house is theirs, without holding its cell" {
        val (connection, sent) = Rig().introduced()

        connection.receive(founding())

        connection.cells().shouldBeEmpty()
        sent.filterIsInstance<YourHouse>().last().yours?.house?.name shouldBe "Ravenscar"
    }

    "founding twice is rejected with the decider's reason as a code" {
        val (connection, sent) = Rig().introduced()

        connection.receive(founding())
        connection.receive(founding(commandId = COMMAND_TWO))

        sent.last() shouldBe CommandRejected(COMMAND_TWO, "alreadyFounded")
    }

    "taking an option founds the house where that option promised, and clears the parchment" {
        val rig = Rig()
        val (player, sent) = rig.introduced()
        val choice = rig.pending()!!
        val taking = choice.options[1]

        player.receive(takingAction(choice.id.value.toString(), taking.id.value.toString()))

        sent.filterIsInstance<CommandAccepted>().single().commandId shouldBe COMMAND_ONE
        val mine = sent.filterIsInstance<YourHouse>().last().yours!!.house
        val promised = taking.effect.shouldBeInstanceOf<Effect.FoundAt>()
        mine.name shouldBe promised.name.value
        mine.seat shouldBe Point(promised.seat.lat, promised.seat.lon)
        // Nothing left to decide: the parchment is gone, and the player is told so.
        sent.filterIsInstance<YourChoice>().last().choice shouldBe null
        rig.pending() shouldBe null
    }

    "and the action and the founding it caused are one story, told in that order" {
        val rig = Rig()
        val (player, _) = rig.introduced()
        val (watching, watcher) = rig.someoneElse()
        watching.receive("""{"type":"watchEvents","on":true}""")
        val choice = rig.pending()!!
        // A watcher is handed what it missed first. What this is about is what comes after it.
        watcher.clear()

        player.receive(takingAction(choice.id.value.toString(), choice.options[0].id.value.toString()))

        val events = watcher.filterIsInstance<EventFrame>()
        events.map { it.eventType } shouldBe
            listOf("villages.player.tookAction.v1", "villages.house.founded.v1")
        // One story, and it began with the choice: the action continues what arriving started.
        events.map { it.correlationId }.distinct() shouldHaveSize 1
        events.map { it.causationId }.distinct() shouldBe listOf(COMMAND_ONE)
        events.map { it.streamVersion } shouldBe listOf(2L, 3L)
    }

    "taking an option that was not offered is refused, and says which rule refused it" {
        val rig = Rig()
        val (player, sent) = rig.introduced()
        val choice = rig.pending()!!

        player.receive(takingAction(choice.id.value.toString(), UUID.randomUUID().toString()))

        sent.last() shouldBe CommandRejected(COMMAND_ONE, "noSuchOption")
    }

    "answering a choice this house was never given is refused" {
        val rig = Rig()
        val (player, sent) = rig.introduced()

        player.receive(takingAction(UUID.randomUUID().toString(), UUID.randomUUID().toString()))

        sent.last() shouldBe CommandRejected(COMMAND_ONE, "noSuchChoice")
    }

    "an option id that is not an identifier at all is refused as malformed" {
        val rig = Rig()
        val (player, sent) = rig.introduced()
        val choice = rig.pending()!!

        player.receive(takingAction(choice.id.value.toString(), "the-second-one"))

        sent.last().shouldBeInstanceOf<CommandRejected>().reason shouldBe
            "malformed: an option id is a UUID, not the-second-one"
    }

    "wiping the world empties it and finishes every session, whoever asked" {
        val rig = Rig()
        val (player, mine) = rig.introduced()
        val (other, theirs) = rig.someoneElse()
        other.receive(founding())
        mine.clear()
        theirs.clear()

        player.receive("""{"type":"wipeWorld"}""")

        // Everybody is told, because a wipe is everybody's.
        mine.last().shouldBeInstanceOf<WorldWiped>().message shouldBe "the world was emptied; 3 events went"
        theirs.last().shouldBeInstanceOf<WorldWiped>()
        rig.world.events.shouldBeEmpty()
        rig.houses.size shouldBe 0
        rig.choices.size shouldBe 0
    }

    "and a session finished by a wipe can do nothing more" {
        val rig = Rig()
        val (player, sent) = rig.introduced()
        player.receive("""{"type":"wipeWorld"}""")
        sent.clear()

        player.receive(founding())
        player.receive(subscribe(STOCKHOLM_Z8))

        sent.shouldBeEmpty()
        player.cells().shouldBeEmpty()
    }

    "a command before hello is rejected, because nobody is speaking" {
        val sent = mutableListOf<ServerFrame>()
        Rig().gateway.connect { sent += it }.receive(founding())

        sent.single() shouldBe CommandRejected(COMMAND_ONE, "notIntroduced")
    }

    "ping is answered with pong carrying the client's stamp and the server's time" {
        val (connection, sent) = Rig().introduced()

        connection.receive("""{"type":"ping","t0":1234}""")

        sent.single() shouldBe Pong(1234, noon.toEpochMilli())
    }

    "subscribing to a cell answers with a snapshot of what is there, at every zoom it is worth drawing at" {
        val rig = Rig()
        val (founder, _) = rig.someoneElse()
        founder.receive(founding())
        val (looker, sent) = rig.introduced(fogLifted = true)

        looker.receive(subscribe(STOCKHOLM_Z10, STOCKHOLM_Z8, STOCKHOLM_Z4))

        val snapshots = sent.map { it.shouldBeInstanceOf<Snapshot>() }
        snapshots.map { it.cell } shouldContainExactly listOf(STOCKHOLM_Z10, STOCKHOLM_Z8, STOCKHOLM_Z4)
        // A founding is worth drawing from zoom eight in; the zoom-four cell is honestly empty.
        snapshots[0].houses.map { it.name } shouldBe listOf("Ravenscar")
        snapshots[0].houses.single().cell shouldBe STOCKHOLM_Z10
        snapshots[1].houses shouldHaveSize 1
        snapshots[2].houses.shouldBeEmpty()
        snapshots.all { it.omitted == 0 } shouldBe true
    }

    "a house founded after subscribing arrives as a delta, once the batch closes" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z8))
        sent.clear()
        val (founder, _) = rig.someoneElse()

        founder.receive(founding())
        sent.shouldBeEmpty()
        rig.later.tick()

        val batch = sent.single().shouldBeInstanceOf<Batch>()
        val appeared = batch.deltas.single().shouldBeInstanceOf<HouseAppeared>()
        appeared.house.name shouldBe "Ravenscar"
        // Version two, behind the choice this player was given, and it still appears rather than changes:
        // whether a house is new is the read model's answer and not the stream version's.
        appeared.house.version shouldBe 2
    }

    "a house that reaches a connection through two of its cells is sent once" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z10, STOCKHOLM_Z8))
        sent.clear()
        val (founder, _) = rig.someoneElse()

        founder.receive(founding())
        rig.later.tick()

        sent.single().shouldBeInstanceOf<Batch>().deltas shouldHaveSize 1
    }

    "a house too ordinary for a coarse cell does not reach a connection holding only that cell" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z4))
        sent.clear()
        val (founder, _) = rig.someoneElse()

        founder.receive(founding())
        rig.later.tick()

        sent.shouldBeEmpty()
    }

    "with the eye open a house too ordinary for a coarse cell is in its snapshot after all" {
        val rig = Rig()
        rig.aHouseIsFounded("Ravenscar")
        val (looker, sent) = rig.introduced(fogLifted = true)

        looker.receive(subscribe(STOCKHOLM_Z4))
        sent.filterIsInstance<Snapshot>().single().houses.shouldBeEmpty()
        sent.clear()

        looker.receive(seeAll(true))

        // Every held cell is answered again, so the map redraws at once rather than at the next pan.
        val snapshot = sent.filterIsInstance<Snapshot>().single()
        snapshot.cell shouldBe STOCKHOLM_Z4
        snapshot.houses.single().name shouldBe "Ravenscar"
    }

    "with the eye open a founding reaches a connection holding only a coarse cell" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z4))
        looker.receive(seeAll(true))
        sent.clear()
        val (founder, _) = rig.someoneElse()

        founder.receive(founding())
        rig.later.tick()

        val batch = sent.single().shouldBeInstanceOf<Batch>()
        batch.deltas.single().shouldBeInstanceOf<HouseAppeared>().house.name shouldBe "Ravenscar"
    }

    "closing the eye answers the held cells again, and they are empty once more" {
        val rig = Rig()
        rig.aHouseIsFounded("Ravenscar")
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z4))
        looker.receive(seeAll(true))
        sent.clear()

        looker.receive(seeAll(false))

        sent.filterIsInstance<Snapshot>().single().houses.shouldBeEmpty()
    }

    "opening the eye twice says nothing the second time" {
        val rig = Rig()
        val (looker, sent) = rig.introduced()
        looker.receive(subscribe(STOCKHOLM_Z4))
        looker.receive(seeAll(true))
        sent.clear()

        looker.receive(seeAll(true))

        sent.shouldBeEmpty()
    }

    "several foundings in a quarter second are one batch" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z8))
        sent.clear()

        rig.aHouseIsFounded("One")
        rig.aHouseIsFounded("Two")
        rig.aHouseIsFounded("Three")
        rig.later.pending shouldBe 1
        rig.later.tick()

        sent.single().shouldBeInstanceOf<Batch>().deltas shouldHaveSize 3
    }

    "a connection that unsubscribed hears nothing more about the cell" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z8))
        looker.receive(unsubscribe(STOCKHOLM_Z8))
        sent.clear()
        val (founder, _) = rig.someoneElse()

        founder.receive(founding())
        rig.later.tick()

        sent.shouldBeEmpty()
        looker.cells().shouldBeEmpty()
    }

    "a connection that went away is forgotten by every cell it held" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z8))
        looker.disconnected()
        sent.clear()
        val (founder, _) = rig.someoneElse()

        founder.receive(founding())
        rig.later.tick()

        sent.shouldBeEmpty()
    }

    // The founder's own house is sent to them before anyone holding its cell is told, so a throw there used
    // to leave the fan-out with nobody told. Seeding closes each connection as its command is accepted.
    "a founder whose socket is closing does not cost whoever holds the cell the house appearing" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z8))
        sent.clear()
        val founder = rig.someoneLeaving()

        founder.receive(founding())
        rig.later.tick()

        val batch = sent.single().shouldBeInstanceOf<Batch>()
        batch.deltas.single().shouldBeInstanceOf<HouseAppeared>().house.name shouldBe "Ravenscar"
    }

    "a watcher whose socket is closing does not cost the other watchers the event" {
        val rig = Rig()
        val (watching, watcher) = rig.introduced()
        watching.receive("""{"type":"watchEvents","on":true}""")
        rig.someoneLeaving("""{"type":"watchEvents","on":true}""")
        watcher.clear()

        rig.aHouseIsFounded()

        watcher.filterIsInstance<EventFrame>().map { it.eventType } shouldContain "villages.house.founded.v1"
    }

    // The stack is in the server's log; the debug panel in every window is told the one line of it.
    "a subscriber that threw on an event is told to every window as a fault" {
        val rig = Rig()
        val (mine, one) = rig.introduced()
        val (_, two) = rig.someoneElse()
        mine.receive(founding())
        val founded = rig.recent.latest(1).single()
        one.clear()
        two.clear()

        rig.world.fault(FeedFault("HousesProjection", founded, IllegalStateException("a fold that is wrong")))

        val told = ErrorFrame(
            "fault",
            "HousesProjection threw on villages.house.founded.v1 (${founded.stream}, version 2): " +
                "IllegalStateException: a fold that is wrong",
        )
        one.single() shouldBe told
        two.single() shouldBe told
    }

    "more cells than a connection may hold is refused, and none of them taken" {
        val (looker, sent) = Rig().introduced()
        val tooMany = (0 until MOST_CELLS + 1).map { it.toString(4).padStart(4, '0') }

        looker.receive(subscribe(*tooMany.toTypedArray()))

        sent.single().shouldBeInstanceOf<ErrorFrame>().code shouldBe "tooManyCells"
        looker.cells().shouldBeEmpty()
    }

    "something that is not a cell is refused" {
        val (looker, sent) = Rig().introduced()

        looker.receive(subscribe("12", "4"))
        looker.receive(subscribe("00000000000"))

        sent.map { it.shouldBeInstanceOf<ErrorFrame>().code } shouldBe listOf("badCell", "badCell")
        looker.cells().shouldBeEmpty()
    }

    "a connection that falls too far behind is told to ask for its cells again, and the backlog is dropped" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z8))
        sent.clear()

        repeat(MOST_WAITING + 1) { index -> rig.aHouseIsFounded("H$index") }

        sent.single() shouldBe Resync(listOf(STOCKHOLM_Z8))
        rig.later.tick()
        // Nothing more: the backlog went with the resync, and so did the cell, so asking again gets a snapshot.
        sent shouldHaveSize 1
        looker.cells().shouldBeEmpty()
        looker.receive(subscribe(STOCKHOLM_Z8))
        sent.last().shouldBeInstanceOf<Snapshot>().houses shouldHaveSize MOST_IN_A_CELL
    }

    "a second window takes the player over, and the first is told and stood down" {
        val rig = Rig()
        val (first, one) = rig.introduced()
        first.receive(subscribe(STOCKHOLM_Z8))
        one.clear()

        val (second, two) = rig.introduced()

        one.single().shouldBeInstanceOf<TakenOver>()
        first.cells().shouldBeEmpty()
        two.shouldBeEmpty()
        second.receive(founding())
        two.last() shouldBe CommandAccepted(COMMAND_ONE)
    }

    "a stood-down session hears nothing more and can do nothing more" {
        val rig = Rig()
        val (first, one) = rig.introduced()
        first.receive(subscribe(STOCKHOLM_Z8))
        rig.introduced()
        one.clear()

        first.receive(founding())
        first.receive(subscribe(STOCKHOLM_Z4))
        first.receive("""{"type":"ping","t0":1}""")
        rig.aHouseIsFounded()
        rig.later.tick()

        one.shouldBeEmpty()
        rig.world.events.filterIsInstance<HouseFounded>().shouldHaveSize(1)
    }

    "the loser's close does not evict the window that took over, however late it arrives" {
        val rig = Rig()
        val (first, _) = rig.introduced()
        val (second, two) = rig.introduced()
        two.clear()

        // The old socket goes away after the takeover, which is the ordinary case and the dangerous one.
        first.disconnected()
        rig.aHouseIsFounded()

        // Still the session: its own house would still find it, and it is still able to act.
        second.receive(founding(name = "Mine"))
        two.last() shouldBe CommandAccepted(COMMAND_ONE)
        two.filterIsInstance<YourHouse>().last().yours?.house?.name shouldBe "Mine"
    }

    "saying hello twice on one connection is refused rather than quietly changing who you are" {
        val (connection, sent) = Rig().introduced()

        connection.receive(hello)

        sent.single().shouldBeInstanceOf<ErrorFrame>().code shouldBe "alreadyIntroduced"
    }

    "a player founds one house, and founding again is refused however many windows have tried" {
        val rig = Rig()
        val (first, _) = rig.introduced()
        first.receive(founding())

        val (second, two) = rig.introduced()
        second.receive(founding(commandId = COMMAND_TWO))

        two.last() shouldBe CommandRejected(COMMAND_TWO, "alreadyFounded")
        rig.world.events.filterIsInstance<HouseFounded>() shouldHaveSize 1
        rig.houses.ofPlayer(PlayerId(UUID.fromString(TOKEN)))?.name?.value shouldBe "Ravenscar"
    }

    "the debug panel's letter is offered, spoken by the house's first key figure, and refused while it has none" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(offering("letter", commandNumber(1)))
        sent.last() shouldBe CommandRejected(commandNumber(1), "noSuchKeyFigure")

        mine.receive(addingAKeyFigure(commandNumber(2)))
        val figure = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        mine.receive(offering("letter", commandNumber(3)))

        sent.last() shouldBe CommandAccepted(commandNumber(3))
        val offered = rig.world.events.filterIsInstance<PlayerOfferedDialogue>().single()
        offered.dialogue.speakers.mapNotNull { it.character?.value?.toString() } shouldBe listOf(figure)
    }

    "a sample that is not one is malformed, and the same offer sent twice is refused as already made" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))

        mine.receive(offering("a song", commandNumber(2)))
        (sent.last() as CommandRejected).reason shouldStartWith "malformed"

        mine.receive(offering("letter", commandNumber(3)))
        mine.receive(offering("letter", commandNumber(3)))
        sent.last() shouldBe CommandRejected(commandNumber(3), "dialogueAlreadyOffered")
        rig.world.events.filterIsInstance<PlayerOfferedDialogue>() shouldHaveSize 1
    }

    "hello also says which dialogues the house has, after what it sees, which is none before it is offered any" {
        val sent = mutableListOf<ServerFrame>()
        Rig().gateway.connect { sent += it }.receive(hello)

        sent[4] shouldBe YourDialogues(emptyList())
    }

    "an offer reaches its player as far as the dialogue choice, and not a line past it" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        mine.receive(offering("letter", commandNumber(2)))

        val told = sent.filterIsInstance<YourDialogues>().last()
        val letter = told.dialogues.single()
        letter.title shouldBe "A letter from the coast"
        letter.said shouldBe emptyList()
        letter.next.map { it.id } shouldBe listOf("arrives", "reads")
        letter.options.map { it.id } shouldBe listOf("accept", "ask", "refuse")
        // Each option shows what taking it will do as the letter was written: whole, hidden, or not at all.
        letter.options.map { it.revealImpact } shouldBe listOf(
            RevealImpactView.Shown(listOf(ImpactView("wealth", -40), ImpactView("wealth", 100))),
            RevealImpactView.Hidden,
            null,
        )
        letter.next.map { it.revealImpact } shouldBe listOf(null, null)
        letter.ending shouldBe EndingView.Open
        // Both answers' replies, and the purse, are the server's until a step reaches them, and what the letter
        // needs to stay open is the server's for good: a player learns of a requirement only when it fails.
        val onTheWire = ProtocolJson.encode(told)
        onTheWire.contains("He thought you might") shouldBe false
        onTheWire.contains("grant") shouldBe false
        onTheWire.contains("alive") shouldBe false
    }

    "each step reaches its player with what the line gave, and the end with nothing left to read" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        mine.receive(offering("letter", commandNumber(2)))
        val offered = rig.world.events.filterIsInstance<PlayerOfferedDialogue>().single()
        fun step(line: String) = rig.world.execute(
            CompleteDialogueStep(offered.houseId, offered.dialogue.id, LineId(line), today, noon),
            Provenance.startedBy(UUID.randomUUID()),
        )

        // Standing behind the quay costs forty, so the house is given it first.
        rig.world.execute(
            GrantResource(offered.houseId, Resource.WEALTH, 50, today, noon),
            Provenance.startedBy(UUID.randomUUID()),
        )
        step("accept")
        val accepted = sent.filterIsInstance<YourDialogues>().last().dialogues.single()
        accepted.said.map { it.id } shouldBe listOf("arrives", "reads", "accept")
        accepted.said.last().effects shouldBe listOf(SpendView(resource = "wealth", amount = 40))
        accepted.next.map { it.id } shouldBe listOf("paid")
        accepted.next.single().words shouldBe "He thought you might say so. The first of the dues came with me."

        step("paid")
        val paid = sent.filterIsInstance<YourDialogues>().last().dialogues.single()
        paid.said.last().effects shouldBe listOf(GrantView(resource = "wealth", amount = 100))
        paid.next shouldBe emptyList()
        paid.options shouldBe emptyList()
        paid.ending shouldBe EndingView.Completed
        paid.revision shouldBe accepted.revision + 2
    }

    "a step sent from the page continues the offer's story, and what the line does comes with it" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        mine.receive(offering("letter", commandNumber(2)))
        val offered = rig.world.events.filterIsInstance<PlayerOfferedDialogue>().single()
        val (watching, watcher) = rig.someoneElse()
        watching.receive("""{"type":"watchEvents","on":true}""")
        // A watcher is handed what it missed first. What this is about is what comes after it.
        watcher.clear()

        mine.receive(stepping(offered.dialogue.id.value.toString(), "ask", commandNumber(3)))
        mine.receive(stepping(offered.dialogue.id.value.toString(), "answer", commandNumber(4)))

        sent.last() shouldBe CommandAccepted(commandNumber(4))
        val events = watcher.filterIsInstance<EventFrame>()
        events.map { it.eventType } shouldBe listOf(
            "villages.player.completedDialogueStep.v1",
            "villages.player.completedDialogueStep.v1",
            "villages.house.resourceGranted.v1",
            "villages.player.completedDialogue.v1",
        )
        // One story, and it began with the offer: each step is caused by its own command.
        events.map { it.correlationId }.distinct() shouldBe listOf(commandNumber(2))
        events.map { it.causationId } shouldBe listOf(commandNumber(3), commandNumber(4), commandNumber(4), commandNumber(4))
        sent.filterIsInstance<YourDialogues>().last().dialogues.single().ending shouldBe EndingView.Completed
    }

    "a step the house will not take is refused under its own name, and a dialogue id that is not one as malformed" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        mine.receive(offering("letter", commandNumber(2)))
        val letter = rig.world.events.filterIsInstance<PlayerOfferedDialogue>().single().dialogue.id.value.toString()

        mine.receive(stepping(letter, "paid", commandNumber(3)))
        sent.last() shouldBe CommandRejected(commandNumber(3), "notTheNextStep")

        mine.receive(stepping(UUID.randomUUID().toString(), "accept", commandNumber(4)))
        sent.last() shouldBe CommandRejected(commandNumber(4), "noSuchDialogue")

        mine.receive(stepping("the letter", "accept", commandNumber(5)))
        (sent.last() as CommandRejected).reason shouldStartWith "malformed"

        mine.receive(stepping(letter, "refuse", commandNumber(6)))
        mine.receive(stepping(letter, "shrugs", commandNumber(7)))
        mine.receive(stepping(letter, "shrugs", commandNumber(8)))
        sent.last() shouldBe CommandRejected(commandNumber(8), "dialogueOver")
    }

    "a lost dialogue reaches its player lost, and why, ended where it stood with nothing to read or choose" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        mine.receive(offering("letter", commandNumber(2)))
        val figure = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        val offered = rig.world.events.filterIsInstance<PlayerOfferedDialogue>().single()

        rig.world.execute(
            FailRequirement(offered.houseId, Requirement.Alive(CharacterId(UUID.fromString(figure))), today, noon),
            Provenance.startedBy(UUID.randomUUID()),
        )

        val lost = sent.filterIsInstance<YourDialogues>().last().dialogues.single()
        lost.ending shouldBe EndingView.Lost(RequirementView.Alive(figure))
        lost.next shouldBe emptyList()
        lost.options shouldBe emptyList()
    }

    "a line still ahead carries what it shows, and a line said carries nothing, so one read back shows nothing" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val figure = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        mine.receive(offering("letter", commandNumber(2)))
        val seat = sent.filterIsInstance<YourHouse>().last().yours!!.house.seat

        val offered = sent.filterIsInstance<YourDialogues>().last().dialogues.single()
        offered.next.map { it.shows } shouldBe listOf(ShowsView.Place(seat), null)

        mine.receive(stepping(offered.id, "ask", commandNumber(3)))
        val asked = sent.filterIsInstance<YourDialogues>().last()
        asked.dialogues.single().next.single().shows shouldBe ShowsView.Character(figure)
        // The rider's line that showed the seat is said now, and on the wire only the line ahead shows anything.
        ProtocolJson.encode(asked).split("\"shows\"").size - 1 shouldBe 1
    }

    "an option that grants or spends reaches the page as what it does, under the wire's name for the resource" {
        Effect.Grant(Resource.NATURAL_DOMAIN, 5).toView() shouldBe GrantView(resource = "naturalDomain", amount = 5)
        Effect.Spend(Resource.WEALTH, 30).toView() shouldBe SpendView(resource = "wealth", amount = 30)
    }

    "a page drawing a master is sent the stands of the tile under a held cell, as far as they touch revealed ground" {
        val rig = Rig()
        rig.standsOnDisk[STOCKHOLM_TILE] = atTheSeat + justOutside + farOff
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        sent.clear()

        mine.receive(subscribe(STOCKHOLM_Z10))

        val stands = sent.filterIsInstance<StandsFrame>().single()
        (stands.x to stands.y) shouldBe (70 to 37)
        recordsOf(stands) shouldBe (atTheSeat + justOutside).toList()
        // After the cell's own snapshot, which is what the page draws first.
        sent.indexOfFirst { it is Snapshot } shouldBeLessThan sent.indexOf(stands)
    }

    "the fog lifted sends every stand of a held tile, and falling again sends only what it lets through" {
        val rig = Rig()
        rig.standsOnDisk[STOCKHOLM_TILE] = atTheSeat + justOutside + farOff
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        mine.receive(subscribe(STOCKHOLM_Z10))
        sent.clear()

        mine.receive(fogOfWar(false))
        recordsOf(sent.filterIsInstance<StandsFrame>().single()) shouldBe (atTheSeat + justOutside + farOff).toList()
        sent.clear()

        mine.receive(fogOfWar(true))
        recordsOf(sent.filterIsInstance<StandsFrame>().single()) shouldBe (atTheSeat + justOutside).toList()
    }

    "vision given near a held tile sends it again with what it now reaches, and a sight change that alters it not sends nothing" {
        val rig = Rig()
        rig.standsOnDisk[STOCKHOLM_TILE] = atTheSeat + justOutside + farOff
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        mine.receive(subscribe(STOCKHOLM_Z10))
        sent.clear()

        // Over the far stand: a hundred units east of the seat on the map.
        mine.receive(givingVision(59.33, 18.07 + 100.0 / 32768.0 * 360.0, commandNumber(1)))
        recordsOf(sent.filterIsInstance<StandsFrame>().single()) shouldBe (atTheSeat + justOutside + farOff).toList()
        sent.clear()

        mine.receive(givingVision(HELSINKI_LAT, HELSINKI_LON, commandNumber(2)))
        sent.filterIsInstance<YourSight>().shouldNotBeEmpty()
        sent.filterIsInstance<StandsFrame>().shouldBeEmpty()
    }

    "a tile is sent once while any held cell is over it, and afresh once none is and one comes back" {
        val rig = Rig()
        rig.standsOnDisk[STOCKHOLM_TILE] = atTheSeat
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        val eastOfIt = Cell.of(59.33, 18.07 + 360.0 / 1024, 10).quadkey
        sent.clear()

        mine.receive(subscribe(STOCKHOLM_Z10, eastOfIt))
        sent.filterIsInstance<StandsFrame>() shouldHaveSize 1
        sent.clear()

        mine.receive(unsubscribe(STOCKHOLM_Z10))
        mine.receive(subscribe(STOCKHOLM_Z10))
        sent.filterIsInstance<StandsFrame>().shouldBeEmpty()

        mine.receive(unsubscribe(STOCKHOLM_Z10, eastOfIt))
        mine.receive(subscribe(STOCKHOLM_Z10))
        recordsOf(sent.filterIsInstance<StandsFrame>().single()) shouldBe atTheSeat.toList()
    }

    "a tile nothing stands in is sent empty, so the page knows it has all there is" {
        val rig = Rig()
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        sent.clear()

        mine.receive(subscribe(STOCKHOLM_Z10))

        sent.filterIsInstance<StandsFrame>().single().stands shouldBe ""
    }

    "a page that names no master is sent no stands, and one the folder has none of is sent every tile empty" {
        val rig = Rig()
        rig.standsOnDisk[STOCKHOLM_TILE] = atTheSeat
        val (nameless, toldNothing) = rig.introduced()
        nameless.receive(founding())
        toldNothing.clear()
        nameless.receive(subscribe(STOCKHOLM_Z10))
        toldNothing.filterIsInstance<StandsFrame>().shouldBeEmpty()

        val (wrong, toldEmpty) = rig.introduced(token = UUID.randomUUID().toString(), master = "nowhere")
        wrong.receive(founding())
        toldEmpty.clear()
        wrong.receive(subscribe(STOCKHOLM_Z10))
        toldEmpty.filterIsInstance<StandsFrame>().single().stands shouldBe ""
    }

    "a cell too coarse for the scenery to be drawn in brings no stands" {
        val rig = Rig()
        rig.standsOnDisk[STOCKHOLM_TILE] = atTheSeat
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        sent.clear()

        mine.receive(subscribe(STOCKHOLM_Z4))

        sent.filterIsInstance<StandsFrame>().shouldBeEmpty()
        StandRecords.count(atTheSeat) shouldBe 1
    }
})
