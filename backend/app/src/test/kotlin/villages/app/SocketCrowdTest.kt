package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.TextWebSocketHandler
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.ProtocolJson
import villages.protocol.Welcome
import villages.protocol.YourChoice
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * A crowd at once: two hundred players arriving together are every one of them welcomed and offered a seat. The checks
 * once passed while a server on virtual-thread sends answered nobody past its fortieth connection, every carrier pinned
 * (experiment 0023); this is the test that would have caught it, many times the carriers a machine has.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SocketCrowdTest {
    @LocalServerPort
    var port: Int = 0

    @Test
    fun `two hundred players arriving at once are every one welcomed and offered a seat`() {
        val players = 200
        val welcomed = ConcurrentHashMap.newKeySet<String>()
        val offered = ConcurrentHashMap.newKeySet<String>()
        // The container's own small buffers: a welcome and a seat are small, and two hundred clients of a megabyte each
        // would fill the test's heap before the server was asked anything.
        val client = StandardWebSocketClient()
        val sessions = (1..players).map {
            val token = UUID.randomUUID().toString()
            client.execute(
                object : TextWebSocketHandler() {
                    override fun afterConnectionEstablished(session: WebSocketSession) {
                        session.sendMessage(TextMessage("""{"type":"hello","playAs":"$token","protocolVersion":$PROTOCOL_VERSION}"""))
                    }

                    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
                        when (ProtocolJson.decodeServer(message.payload)) {
                            is Welcome -> welcomed += token
                            is YourChoice -> offered += token
                            else -> Unit
                        }
                    }
                },
                "ws://localhost:$port/ws",
            )
        }.map { it.get(20, TimeUnit.SECONDS) }

        val giveUp = System.nanoTime() + TimeUnit.SECONDS.toNanos(30)
        while ((welcomed.size < players || offered.size < players) && System.nanoTime() < giveUp) Thread.sleep(50)
        sessions.forEach { it.close() }

        assertEquals(players, welcomed.size, "every player welcomed")
        assertEquals(players, offered.size, "every player offered a seat")
    }
}
