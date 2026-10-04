package villages.gateway

import villages.application.AnonymousTokens
import villages.application.Arrival
import villages.application.EventFeed
import villages.application.FaultBoard
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
import villages.application.started
import villages.application.fate.FateEngine
import villages.application.fate.FirstPools
import villages.application.fate.HouseOmens
import villages.application.fate.ResourceActions
import villages.application.fate.RollService
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
import villages.domain.PlayerRolled
import villages.domain.PlayerTookAction
import villages.domain.PlayerId
import villages.domain.WorldTime
import villages.projections.CharactersProjection
import villages.projections.ChoicesProjection
import villages.projections.DialoguesProjection
import villages.projections.HousesProjection
import villages.projections.RecentEventsProjection
import villages.projections.SightProjection
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.ServerFrame
import villages.protocol.STAND_TILES
import java.time.Clock
import java.time.ZoneOffset
import java.util.UUID
import java.util.concurrent.Executor

/*
 * What the gateway's specs stand on: a world small enough to hold in a test, a later that is whenever the
 * test says, and a rig that builds the real projections and services over them. See the specs beside it.
 */

/** The catalogued type of an event, as the store would name it. */
internal fun typeOf(event: HouseEvent): String = when (event) {
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
    is PlayerRolled -> "villages.player.rolled.v1"
    is PlayerTookAction -> "villages.player.tookAction.v1"
}

/** Enough of the data for the panel's sake. The stored form proper is pinned by its own fixture. */
internal fun dataOf(event: HouseEvent): String = when (event) {
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
    is PlayerRolled -> """{"rarity":"${event.rarity}","omens":${event.omens.size}}"""
    is PlayerTookAction -> """{"optionId":"${event.optionId.value}"}"""
}

/** A character's events, catalogued the same way; the panel's copy of their data is not what is tested here. */
internal fun typeOf(event: CharacterEvent): String =
    "villages.character.${event::class.simpleName!!.removePrefix("Character").replaceFirstChar { it.lowercase() }}.v1"

/**
 * A world small enough to hold in a test: one list of events, folded per stream, and a feed that delivers
 * synchronously. The gateway never knows the difference, which is the point of the ports.
 */
internal class TinyWorld : HouseCommandExecutor, CharacterCommandExecutor, EventFeed {
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

}

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
internal class Rig(instrumentsOpen: Boolean = true, sendOn: Executor = Executor { it.run() }) {
    val world = TinyWorld()
    val later = ManualLater()
    val houses = HousesProjection(world).started()
    val choices = ChoicesProjection(world).started()
    val recent = RecentEventsProjection(world).started()
    val characters = CharactersProjection(world).started()
    val sights = SightProjection(world).started()
    val dialogueRows = DialoguesProjection(world).started()
    val worldClock = WorldClock { today }

    /** The choice roll over the first content, with a die that always comes up one: common, and the first in the draw. */
    val rolls = RollService(
        FateEngine(listOf(HouseOmens()), FirstPools.ALL, ResourceActions.ALL, { 1 }, { UUID.randomUUID() }),
        houses, world, { noon }, worldClock, { UUID.randomUUID() },
    )
    var minted = 0

    /** The one master's stands, tile by tile, as the sprite map's folder would hold them. */
    val standsOnDisk = mutableMapOf<Int, ByteArray>()

    /** Where the gateway hears that something acting on its own threw, said on purpose by a test. */
    val faults = FaultBoard()
    val gateway = Gateway(
        tokens = AnonymousTokens,
        foundHouse = FoundHouseService(world, clock = { noon }, world = worldClock),
        events = world,
        faults = faults,
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
        instrumentsOpen = instrumentsOpen,
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
