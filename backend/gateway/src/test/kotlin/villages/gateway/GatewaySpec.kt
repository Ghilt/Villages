package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.application.AnonymousTokens
import villages.application.Arrival
import villages.application.EventFeed
import villages.application.FoundHouseService
import villages.application.HouseCommandExecutor
import villages.application.Provenance
import villages.application.Start
import villages.application.StoredEvent
import villages.application.TakeActionService
import villages.application.WorldClock
import villages.application.WriteConflict
import villages.domain.Effect
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseEvent
import villages.domain.HouseFounded
import villages.domain.HouseResourceSpent
import villages.domain.HouseResourceReleased
import villages.domain.HouseResourcePledged
import villages.domain.HouseResourceGranted
import villages.domain.PlayerGivenChoice
import villages.domain.HouseId
import villages.domain.PlayerTookAction
import villages.domain.PlayerId
import villages.domain.WorldTime
import villages.projections.ChoicesProjection
import villages.projections.HousesProjection
import villages.projections.RecentEventsProjection
import villages.protocol.Batch
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.ErrorFrame
import villages.protocol.FoundAtView
import villages.protocol.EventFrame
import villages.protocol.HouseAppeared
import villages.protocol.Point
import villages.protocol.Pong
import villages.protocol.ProtocolJson
import villages.protocol.Resync
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.TakenOver
import villages.protocol.Welcome
import villages.protocol.WorldWiped
import villages.protocol.WorldNow
import villages.protocol.YourChoice
import villages.protocol.YourHouse
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID

/**
 * A world small enough to hold in a test: one list of events, folded per stream, and a feed that delivers
 * synchronously. The gateway never knows the difference, which is the point of the ports.
 */
/** The catalogued type of an event, as the store would name it. */
private fun typeOf(event: HouseEvent): String = when (event) {
    is HouseFounded -> "villages.house.founded.v1"
    is HouseResourceGranted -> "villages.house.resourceGranted.v1"
    is HouseResourcePledged -> "villages.house.resourcePledged.v1"
    is HouseResourceReleased -> "villages.house.resourceReleased.v1"
    is HouseResourceSpent -> "villages.house.resourceSpent.v1"
    is PlayerGivenChoice -> "villages.player.givenChoice.v1"
    is PlayerTookAction -> "villages.player.tookAction.v1"
}

/** Enough of the data for the panel's sake. The stored form proper is pinned by its own fixture. */
private fun dataOf(event: HouseEvent): String = when (event) {
    is HouseFounded -> """{"name":"${event.name.value}","significance":${event.significance.value}}"""
    is HouseResourceGranted -> """{"resource":"${event.resource}","amount":${event.amount}}"""
    is HouseResourcePledged -> """{"resource":"${event.resource}","amount":${event.amount}}"""
    is HouseResourceReleased -> """{"pledgeId":"${event.pledgeId.value}"}"""
    is HouseResourceSpent -> """{"resource":"${event.resource}","amount":${event.amount}}"""
    is PlayerGivenChoice -> """{"prompt":"${event.choice.prompt}","options":${event.choice.options.size}}"""
    is PlayerTookAction -> """{"optionId":"${event.optionId.value}"}"""
}

private class TinyWorld : HouseCommandExecutor, EventFeed {
    val events = mutableListOf<HouseEvent>()

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

/** Later is whenever the test says. */
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

/** Stockholm, before the warp, at three depths: the shared vector every zoom of it is known for. */
private const val STOCKHOLM_Z10 = "1200312213"
private const val STOCKHOLM_Z8 = "12003122"
private const val STOCKHOLM_Z4 = "1200"

private fun founding(commandId: String = COMMAND_ONE, name: String = "Ravenscar") =
    """{"type":"command","commandId":"$commandId","command":{"type":"foundHouse",""" +
        """"name":"$name","seat":{"lat":59.33,"lon":18.07},""" +
        """"banner":{"field":"sable","division":"plain","charge":"stag","chargeTincture":"argent"}}}"""

private fun takingAction(choiceId: String, optionId: String, commandId: String = COMMAND_ONE) =
    """{"type":"command","commandId":"$commandId","command":{"type":"takeAction",""" +
        """"choiceId":"$choiceId","optionId":"$optionId"}}"""

private fun subscribe(vararg cells: String) =
    """{"type":"subscribeCells","cells":[${cells.joinToString { "\"$it\"" }}]}"""

private fun unsubscribe(vararg cells: String) =
    """{"type":"unsubscribeCells","cells":[${cells.joinToString { "\"$it\"" }}]}"""

private fun seeAll(on: Boolean) = """{"type":"seeAll","on":$on}"""

private class Rig {
    val world = TinyWorld()
    val later = ManualLater()
    val houses = HousesProjection(world)
    val choices = ChoicesProjection(world)
    val recent = RecentEventsProjection(world)
    val worldClock = WorldClock { today }
    var minted = 0
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
        choices = choices,
        recent = recent,
        emptyTheWorld = {
            val gone = world.events.size
            world.events.clear()
            houses.reset()
            choices.reset()
            recent.reset()
            gone
        },
        later = later,
    )

    /** The choice a player is holding, as the gateway would send it. */
    fun pending(token: String = TOKEN) = choices.pendingOf(PlayerId(UUID.fromString(token)))?.choice

    /**
     * A connection that has said hello, and everything it has been sent since. Every call uses the same
     * token unless told otherwise, so two of these are two windows of one player - which is exactly the
     * case worth testing, and now the case that ends in a takeover.
     */
    fun introduced(token: String = TOKEN): Pair<Gateway.Connection, MutableList<ServerFrame>> {
        val sent = mutableListOf<ServerFrame>()
        val connection = gateway.connect { sent += it }
        connection.receive("""{"type":"hello","playerToken":"$token","protocolVersion":$PROTOCOL_VERSION}""")
        sent.clear()
        return connection to sent
    }

    /** Somebody else entirely: a fresh token, so this is another player rather than a takeover. */
    fun someoneElse(): Pair<Gateway.Connection, MutableList<ServerFrame>> =
        introduced(UUID.randomUUID().toString())

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
        val (neighbour, theirs) = rig.someoneElse()
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
        val (looker, sent) = rig.introduced()
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
        val (looker, sent) = rig.introduced()

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
        val (looker, sent) = rig.introduced()
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
        val (looker, sent) = rig.introduced()
        looker.receive(subscribe(STOCKHOLM_Z10, STOCKHOLM_Z8))
        sent.clear()
        val (founder, _) = rig.someoneElse()

        founder.receive(founding())
        rig.later.tick()

        sent.single().shouldBeInstanceOf<Batch>().deltas shouldHaveSize 1
    }

    "a house too ordinary for a coarse cell does not reach a connection holding only that cell" {
        val rig = Rig()
        val (looker, sent) = rig.introduced()
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
        val (looker, sent) = rig.introduced()

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
        val (looker, sent) = rig.introduced()
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
        val (looker, sent) = rig.introduced()
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
        val (looker, sent) = rig.introduced()
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
        val (looker, sent) = rig.introduced()
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
        val (looker, sent) = rig.introduced()
        looker.receive(subscribe(STOCKHOLM_Z8))
        looker.disconnected()
        sent.clear()
        val (founder, _) = rig.someoneElse()

        founder.receive(founding())
        rig.later.tick()

        sent.shouldBeEmpty()
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
        val (looker, sent) = rig.introduced()
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
})
