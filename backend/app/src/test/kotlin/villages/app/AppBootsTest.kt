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
import villages.protocol.Welcome
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * The whole process, booted: a real socket to /ws, hello answered with welcome, a house founded, and the
 * event back on the same socket. This is increment 0.9's proof without MongoDB, and the walking skeleton's
 * spine in one test. JUnit rather than Kotest here only because Spring's test support speaks JUnit.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AppBootsTest {
    @LocalServerPort
    var port: Int = 0

    @Test
    fun `hello is welcomed, and a founded house comes back as an event`() {
        val received = CopyOnWriteArrayList<ServerFrame>()
        val three = CountDownLatch(3)
        val session: WebSocketSession = StandardWebSocketClient()
            .execute(
                object : TextWebSocketHandler() {
                    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
                        received += ProtocolJson.decodeServer(message.payload)
                        three.countDown()
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
        session.close()
    }
}
