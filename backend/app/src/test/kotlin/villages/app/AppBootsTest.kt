package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.TextWebSocketHandler
import villages.protocol.CommandRejected
import villages.protocol.EventFrame
import villages.protocol.ProtocolJson
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.TakenOver
import villages.protocol.Welcome
import villages.protocol.YourHouse
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit

/**
 * The whole process, booted, over real sockets: a house founded and read back from the map, and then the
 * two rules of decision 0028 — a player has one house, and plays from one place.
 *
 * JUnit rather than Kotest here only because Spring's test support speaks JUnit.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AppBootsTest {
    @LocalServerPort
    var port: Int = 0

    /** One window: a socket, and everything the gateway has said to it. */
    private class Window(port: Int) {
        val heard = CopyOnWriteArrayList<ServerFrame>()
        private val session: WebSocketSession = StandardWebSocketClient()
            .execute(
                object : TextWebSocketHandler() {
                    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
                        heard += ProtocolJson.decodeServer(message.payload)
                    }
                },
                "ws://localhost:$port/ws",
            )
            .get(10, TimeUnit.SECONDS)

        fun say(json: String) = session.sendMessage(TextMessage(json))

        fun close() = session.close()

        /** Waits for something to be true of what has been heard, rather than for a count of frames. */
        fun until(what: String, ready: (List<ServerFrame>) -> Boolean) {
            val giveUp = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
            while (System.nanoTime() < giveUp) {
                if (ready(heard)) return
                Thread.sleep(20)
            }
            throw AssertionError("waited for $what and never saw it; heard $heard")
        }

        inline fun <reified T : ServerFrame> last(): T = heard.filterIsInstance<T>().last()
    }

    private val token = "0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"

    /** A command id is a UUID, and the gateway refuses anything else. See decision record 0035. */
    private val founding1 = "1c000001-0000-4000-8000-00000000000a"
    private val founding2 = "1c000002-0000-4000-8000-00000000000b"
    private val hello = """{"type":"hello","playerToken":"$token","protocolVersion":1}"""
    private val founding =
        """{"type":"command","commandId":"$founding1","command":{"type":"foundHouse","name":"Ravenscar",""" +
            """"seat":{"lat":59.33,"lon":18.07},""" +
            """"banner":{"field":"sable","division":"plain","charge":"stag","chargeTincture":"argent"}}}"""

    /** Stockholm before the warp, at the zoom a founding is worth drawing from. */
    private val cell = "12003122"

    @Test
    fun `a house is founded, read back from the map, and belongs to the one player who plays from one place`() {
        val first = Window(port)
        first.say(hello)
        // Welcome and the house are two frames: wait for the second, or the first arrives on its own.
        first.until("a welcome and a house") { frames ->
            frames.any { it is Welcome } && frames.any { it is YourHouse }
        }
        assertNull(first.last<YourHouse>().house, "a new player has no house yet")

        first.say("""{"type":"watchEvents","on":true}""")
        first.say(founding)
        first.until("the event and the house") { frames ->
            frames.any { it is EventFrame } && frames.filterIsInstance<YourHouse>().last().house != null
        }

        val event = first.heard.filterIsInstance<EventFrame>().single()
        assertEquals("villages.house.founded.v1", event.eventType)
        // The stream is worked out from the player, not chosen by the client: see HouseId.of.
        assertEquals("house:49d14206-e7b6-3cff-b12c-0fa929182509", event.stream)
        assertEquals("Ravenscar", first.last<YourHouse>().house?.name)

        first.say("""{"type":"subscribeCells","cells":["$cell"]}""")
        first.until("a snapshot") { frames -> frames.any { it is Snapshot } }
        val snapshot = first.last<Snapshot>()
        assertEquals(cell, snapshot.cell)
        assertEquals(listOf("Ravenscar"), snapshot.houses.map { it.name })

        // A second window of the same player takes over, and is told the house is already theirs.
        val second = Window(port)
        second.say(hello)
        second.until("the house on hello") { frames -> frames.filterIsInstance<YourHouse>().isNotEmpty() }
        assertEquals("Ravenscar", second.last<YourHouse>().house?.name)

        first.until("being stood down") { frames -> frames.any { it is TakenOver } }
        assertNotNull(first.last<TakenOver>().message)

        // And there is still one house: founding again is refused, whichever window asks.
        second.say("""{"type":"command","commandId":"$founding2","command":{"type":"foundHouse","name":"Another",""" +
            """"seat":{"lat":59.33,"lon":18.07},""" +
            """"banner":{"field":"or","division":"plain","charge":"star","chargeTincture":"azure"}}}""")
        second.until("a refusal") { frames -> frames.any { it is CommandRejected } }
        assertEquals("alreadyFounded", second.last<CommandRejected>().reason)

        second.say("""{"type":"subscribeCells","cells":["$cell"]}""")
        second.until("a snapshot") { frames -> frames.any { it is Snapshot } }
        assertEquals(1, second.last<Snapshot>().houses.size, "one player, one house")

        first.close()
        second.close()
    }
}
