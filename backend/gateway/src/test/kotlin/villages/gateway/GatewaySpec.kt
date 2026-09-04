package villages.gateway

import io.kotest.core.spec.style.StringSpec
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
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.ErrorFrame
import villages.protocol.EventFrame
import villages.protocol.Pong
import villages.protocol.ProtocolJson
import villages.protocol.ServerFrame
import villages.protocol.Welcome
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

/**
 * A world small enough to hold in a test: one stream in a list, and a feed that delivers synchronously.
 * The gateway never knows the difference, which is the point of the ports.
 */
private class TinyWorld : HouseCommandExecutor, EventFeed {
    val events = mutableListOf<HouseEvent>()
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun execute(command: HouseCommand) {
        val fresh = HouseDecider.decide(command, HouseDecider.fold(events))
        events += fresh
        fresh.forEach { event ->
            val founded = event as HouseFounded
            val stored = StoredEvent(
                id = "e-${events.size}",
                type = "villages.house.founded.v1",
                stream = founded.houseId.stream,
                streamVersion = events.size.toLong(),
                time = founded.at,
                data = """{"name":"${founded.name.value}","cell":"${founded.cell.quadkey}"}""",
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

private val noon = Instant.parse("2026-09-04T12:00:00Z")
private const val TOKEN = "0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"
private val hello = """{"type":"hello","playerToken":"$TOKEN","protocolVersion":1}"""
private val found = """{"type":"command","commandId":"c-1","command":{"type":"foundHouse",""" +
    """"houseId":"6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a","name":"Ravenscar","seat":{"lat":59.33,"lon":18.07},""" +
    """"banner":{"field":"sable","division":"plain","charge":"stag","chargeTincture":"argent"}}}"""

private fun gatewayOver(world: TinyWorld) = Gateway(
    tokens = AnonymousTokens,
    foundHouse = FoundHouseService(world, clock = { noon }),
    events = world,
    clock = Clock.fixed(noon, ZoneOffset.UTC),
)

class GatewaySpec : StringSpec({

    "hello is answered with welcome, naming the player and the server's time" {
        val sent = mutableListOf<ServerFrame>()
        gatewayOver(TinyWorld()).connect { sent += it }.receive(hello)

        sent.single() shouldBe Welcome(serverTime = noon.toEpochMilli(), playerId = TOKEN)
    }

    "a client of another protocol version, or with no token, is told so and not welcomed" {
        val sent = mutableListOf<ServerFrame>()
        val connection = gatewayOver(TinyWorld()).connect { sent += it }

        connection.receive("""{"type":"hello","playerToken":"$TOKEN","protocolVersion":2}""")
        connection.receive("""{"type":"hello","playerToken":"nope","protocolVersion":1}""")
        connection.receive("this is not json")

        sent.map { it.shouldBeInstanceOf<ErrorFrame>().code } shouldBe listOf("protocolVersion", "playerToken", "unreadable")
    }

    "a founding command is accepted, and the event reaches everyone watching" {
        val world = TinyWorld()
        val gateway = gatewayOver(world)
        val founder = mutableListOf<ServerFrame>()
        val watcher = mutableListOf<ServerFrame>()
        val bystander = mutableListOf<ServerFrame>()
        val founding = gateway.connect { founder += it }
        val watching = gateway.connect { watcher += it }
        gateway.connect { bystander += it }.receive(hello)
        founding.receive(hello)
        watching.receive(hello)
        watching.receive("""{"type":"watchEvents","on":true}""")

        founding.receive(found)

        founder.last() shouldBe CommandAccepted("c-1")
        world.events shouldHaveSize 1
        val event = watcher.last().shouldBeInstanceOf<EventFrame>()
        event.eventType shouldBe "villages.house.founded.v1"
        event.stream shouldBe "house:6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"
        event.streamVersion shouldBe 1
        event.time shouldBe noon.toEpochMilli()
        event.data.get("cell").asString() shouldBe "12003122"
        bystander shouldHaveSize 1
    }

    "founding twice is rejected with the decider's reason as a code" {
        val sent = mutableListOf<ServerFrame>()
        val connection = gatewayOver(TinyWorld()).connect { sent += it }
        connection.receive(hello)

        connection.receive(found)
        connection.receive(found)

        sent.last() shouldBe CommandRejected("c-1", "alreadyFounded")
    }

    "a command before hello is rejected, and ping is answered with the time" {
        val sent = mutableListOf<ServerFrame>()
        val connection = gatewayOver(TinyWorld()).connect { sent += it }

        connection.receive(found)
        connection.receive("""{"type":"ping","t0":123}""")

        sent[0] shouldBe CommandRejected("c-1", "notIntroduced")
        sent[1] shouldBe Pong(123, noon.toEpochMilli())
    }

    "the wire's heraldry becomes the domain's, and a banner that breaks the rule is rejected as such" {
        val sent = mutableListOf<ServerFrame>()
        val connection = gatewayOver(TinyWorld()).connect { sent += it }
        connection.receive(hello)

        connection.receive(found.replace("\"chargeTincture\":\"argent\"", "\"chargeTincture\":\"gules\""))

        sent.last() shouldBe CommandRejected("c-1", "invalidBanner")
        ProtocolJson.encode(sent.last()).contains("invalidBanner") shouldBe true
    }
})
