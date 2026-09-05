package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.TextWebSocketHandler
import villages.protocol.EventFrame
import villages.protocol.ProtocolJson
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.Welcome
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * The whole process, booted: a real socket to /ws, hello answered with welcome, a house founded, the
 * event back on the same socket, and then the house served from the read model on subscribing to its
 * cell. This is the walking skeleton's spine in one test, without MongoDB. JUnit rather than Kotest here
 * only because Spring's test support speaks JUnit.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AppBootsTest {
    @LocalServerPort
    var port: Int = 0

    @Test
    fun `hello is welcomed, a founded house comes back as an event, and a cell answers with it`() {
        val received = CopyOnWriteArrayList<ServerFrame>()
        val three = CountDownLatch(3)
        val four = CountDownLatch(4)
        val session: WebSocketSession = StandardWebSocketClient()
            .execute(
                object : TextWebSocketHandler() {
                    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
                        received += ProtocolJson.decodeServer(message.payload)
                        three.countDown()
                        four.countDown()
                    }
                },
                "ws://localhost:$port/ws",
            )
            .get(10, TimeUnit.SECONDS)

        session.sendMessage(TextMessage("""{"type":"hello","playerToken":"0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d","protocolVersion":1}"""))
        session.sendMessage(TextMessage("""{"type":"watchEvents","on":true}"""))
        session.sendMessage(
            TextMessage(
                """{"type":"command","commandId":"c-1","command":{"type":"foundHouse","houseId":"6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a",""" +
                    """"name":"Ravenscar","seat":{"lat":59.33,"lon":18.07},"banner":{"field":"sable","division":"plain","charge":"stag","chargeTincture":"argent"}}}""",
            ),
        )

        assertTrue(three.await(10, TimeUnit.SECONDS), "expected welcome, commandAccepted and the event, got $received")
        assertTrue(received[0] is Welcome, "first frame should be welcome: $received")
        val event = received.filterIsInstance<EventFrame>().single()
        assertEquals("villages.house.founded.v1", event.eventType)
        assertEquals("house:6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a", event.stream)

        // Stockholm's cell at zoom eight, which a founding is worth drawing from. The read model has folded
        // the event by now, so the snapshot carries the house.
        session.sendMessage(TextMessage("""{"type":"subscribeCells","cells":["12003122"]}"""))
        assertTrue(four.await(10, TimeUnit.SECONDS), "expected a snapshot as well, got $received")
        val snapshot = received.filterIsInstance<Snapshot>().single()
        assertEquals("12003122", snapshot.cell)
        assertEquals(listOf("Ravenscar"), snapshot.houses.map { it.name })
        assertEquals(0, snapshot.omitted)
        session.close()
    }
}
