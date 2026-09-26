package villages.app

import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import villages.protocol.Pong
import villages.protocol.ProtocolJson
import java.io.IOException
import java.lang.reflect.Proxy

/**
 * A frame for a socket that is going is dropped rather than thrown into the gateway. Each fake says it is
 * open while its send fails, because that is what Tomcat's session does while it is closing.
 */
class GatewaySocketTest {
    private fun session(send: (TextMessage) -> Unit): WebSocketSession =
        Proxy.newProxyInstance(javaClass.classLoader, arrayOf(WebSocketSession::class.java)) { _, method, args ->
            when (method.name) {
                "isOpen" -> true
                "sendMessage" -> send(args!![0] as TextMessage)
                else -> throw UnsupportedOperationException(method.name)
            }
        } as WebSocketSession

    @Test
    fun `an open session is sent the frame as text`() {
        val sent = mutableListOf<String>()

        session { sent += it.payload }.sendUnlessGoing(Pong(1, 2))

        assertEquals(listOf(ProtocolJson.encode(Pong(1, 2))), sent)
    }

    @Test
    fun `a send to a session closed under it is dropped rather than thrown`() {
        val closing = session {
            throw IllegalStateException("Message will not be sent because the WebSocket session has been closed")
        }

        assertDoesNotThrow { closing.sendUnlessGoing(Pong(1, 2)) }
    }

    @Test
    fun `a send on a connection that failed is dropped rather than thrown`() {
        val broken = session { throw IOException("An established connection was aborted") }

        assertDoesNotThrow { broken.sendUnlessGoing(Pong(1, 2)) }
    }
}
