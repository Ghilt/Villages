package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.application.AnonymousTokens
import villages.application.EventFeed
import villages.application.FoundHouseService
import villages.application.HouseCommandExecutor
import villages.application.StoredEvent
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseEvent
import villages.domain.HouseFounded
import villages.projections.HousesByCellProjection
import villages.protocol.Batch
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.ErrorFrame
import villages.protocol.EventFrame
import villages.protocol.HouseAppeared
import villages.protocol.Pong
import villages.protocol.ProtocolJson
import villages.protocol.Resync
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.Welcome
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID

/**
 * A world small enough to hold in a test: one list of events, folded per stream, and a feed that delivers
 * synchronously. The gateway never knows the difference, which is the point of the ports.
 */
private class TinyWorld : HouseCommandExecutor, EventFeed {
    val events = mutableListOf<HouseEvent>()
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun execute(command: HouseCommand) {
        val stream = events.filter { it.houseId == command.houseId }
        val fresh = HouseDecider.decide(command, HouseDecider.fold(stream))
        events += fresh
        fresh.forEachIndexed { index, event ->
            val founded = event as HouseFounded
            val stored = StoredEvent(
                id = "e-${events.size}",
                type = "villages.house.founded.v1",
                stream = founded.houseId.stream,
                streamVersion = (stream.size + index + 1).toLong(),
                time = founded.at,
                data = """{"name":"${founded.name.value}","significance":${founded.significance.value}}""",
                event = event,
            )
            subscribers.toList().forEach { it(stored) }
        }
    }

    override fun subscribe(subscriber: (StoredEvent) -> Unit): AutoCloseable {
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
private const val TOKEN = "0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"
private val hello = """{"type":"hello","playerToken":"$TOKEN","protocolVersion":1}"""
private const val RAVENSCAR = "6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"

/** Stockholm, before the warp, at three depths: the shared vector every zoom of it is known for. */
private const val STOCKHOLM_Z10 = "1200312213"
private const val STOCKHOLM_Z8 = "12003122"
private const val STOCKHOLM_Z4 = "1200"

private fun founding(houseId: String = RAVENSCAR, commandId: String = "c-1", name: String = "Ravenscar") =
    """{"type":"command","commandId":"$commandId","command":{"type":"foundHouse",""" +
        """"houseId":"$houseId","name":"$name","seat":{"lat":59.33,"lon":18.07},""" +
        """"banner":{"field":"sable","division":"plain","charge":"stag","chargeTincture":"argent"}}}"""

private fun subscribe(vararg cells: String) =
    """{"type":"subscribeCells","cells":[${cells.joinToString { "\"$it\"" }}]}"""

private fun unsubscribe(vararg cells: String) =
    """{"type":"unsubscribeCells","cells":[${cells.joinToString { "\"$it\"" }}]}"""

private class Rig {
    val world = TinyWorld()
    val later = ManualLater()
    val houses = HousesByCellProjection(world)
    val gateway = Gateway(
        tokens = AnonymousTokens,
        foundHouse = FoundHouseService(world, clock = { noon }),
        events = world,
        houses = houses,
        clock = Clock.fixed(noon, ZoneOffset.UTC),
        later = later,
    )

    /** A connection that has said hello, and everything it has been sent. */
    fun introduced(): Pair<Gateway.Connection, MutableList<ServerFrame>> {
        val sent = mutableListOf<ServerFrame>()
        val connection = gateway.connect { sent += it }
        connection.receive(hello)
        sent.clear()
        return connection to sent
    }
}

class GatewaySpec : StringSpec({

    "hello is answered with welcome, naming the player and the server's time" {
        val sent = mutableListOf<ServerFrame>()
        Rig().gateway.connect { sent += it }.receive(hello)

        sent.single() shouldBe Welcome(serverTime = noon.toEpochMilli(), playerId = TOKEN)
    }

    "a client of another protocol version, or with no token, is told so and not welcomed" {
        val sent = mutableListOf<ServerFrame>()
        val connection = Rig().gateway.connect { sent += it }

        connection.receive("""{"type":"hello","playerToken":"$TOKEN","protocolVersion":2}""")
        connection.receive("""{"type":"hello","playerToken":"nope","protocolVersion":1}""")
        connection.receive("this is not json")

        sent.map { it.shouldBeInstanceOf<ErrorFrame>().code } shouldBe listOf("protocolVersion", "playerToken", "unreadable")
    }

    "a founding command is accepted, and the event reaches everyone watching" {
        val rig = Rig()
        val (founding, founder) = rig.introduced()
        val (watching, watcher) = rig.introduced()
        val (_, bystander) = rig.introduced()
        watching.receive("""{"type":"watchEvents","on":true}""")

        founding.receive(founding())

        founder.last() shouldBe CommandAccepted("c-1")
        rig.world.events shouldHaveSize 1
        val event = watcher.last().shouldBeInstanceOf<EventFrame>()
        event.eventType shouldBe "villages.house.founded.v1"
        event.stream shouldBe "house:$RAVENSCAR"
        event.streamVersion shouldBe 1
        event.time shouldBe noon.toEpochMilli()
        event.data.get("significance").asDouble() shouldBe 20.0
        bystander.shouldBeEmpty()
    }

    "founding twice is rejected with the decider's reason as a code" {
        val (connection, sent) = Rig().introduced()

        connection.receive(founding())
        connection.receive(founding(commandId = "c-2"))

        sent.last() shouldBe CommandRejected("c-2", "alreadyFounded")
    }

    "a command before hello is rejected, because nobody is speaking" {
        val sent = mutableListOf<ServerFrame>()
        Rig().gateway.connect { sent += it }.receive(founding())

        sent.single() shouldBe CommandRejected("c-1", "notIntroduced")
    }

    "ping is answered with pong carrying the client's stamp and the server's time" {
        val (connection, sent) = Rig().introduced()

        connection.receive("""{"type":"ping","t0":1234}""")

        sent.single() shouldBe Pong(1234, noon.toEpochMilli())
    }

    "subscribing to a cell answers with a snapshot of what is there, at every zoom it is worth drawing at" {
        val rig = Rig()
        val (founder, _) = rig.introduced()
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
        val (founder, _) = rig.introduced()

        founder.receive(founding())
        sent.shouldBeEmpty()
        rig.later.tick()

        val batch = sent.single().shouldBeInstanceOf<Batch>()
        val appeared = batch.deltas.single().shouldBeInstanceOf<HouseAppeared>()
        appeared.house.name shouldBe "Ravenscar"
        appeared.house.version shouldBe 1
    }

    "a house that reaches a connection through two of its cells is sent once" {
        val rig = Rig()
        val (looker, sent) = rig.introduced()
        looker.receive(subscribe(STOCKHOLM_Z10, STOCKHOLM_Z8))
        sent.clear()
        val (founder, _) = rig.introduced()

        founder.receive(founding())
        rig.later.tick()

        sent.single().shouldBeInstanceOf<Batch>().deltas shouldHaveSize 1
    }

    "a house too ordinary for a coarse cell does not reach a connection holding only that cell" {
        val rig = Rig()
        val (looker, sent) = rig.introduced()
        looker.receive(subscribe(STOCKHOLM_Z4))
        sent.clear()
        val (founder, _) = rig.introduced()

        founder.receive(founding())
        rig.later.tick()

        sent.shouldBeEmpty()
    }

    "several foundings in a quarter second are one batch" {
        val rig = Rig()
        val (looker, sent) = rig.introduced()
        looker.receive(subscribe(STOCKHOLM_Z8))
        sent.clear()
        val (founder, _) = rig.introduced()

        founder.receive(founding(houseId = UUID.randomUUID().toString(), commandId = "c-1", name = "One"))
        founder.receive(founding(houseId = UUID.randomUUID().toString(), commandId = "c-2", name = "Two"))
        founder.receive(founding(houseId = UUID.randomUUID().toString(), commandId = "c-3", name = "Three"))
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
        val (founder, _) = rig.introduced()

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
        val (founder, _) = rig.introduced()

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
        val (founder, _) = rig.introduced()

        repeat(MOST_WAITING + 1) { index ->
            founder.receive(founding(houseId = UUID.randomUUID().toString(), commandId = "c-$index", name = "H$index"))
        }

        sent.single() shouldBe Resync(listOf(STOCKHOLM_Z8))
        rig.later.tick()
        // Nothing more: the backlog went with the resync, and the client will take a fresh snapshot.
        sent shouldHaveSize 1
    }
})
