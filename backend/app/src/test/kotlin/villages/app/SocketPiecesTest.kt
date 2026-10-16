package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.TextWebSocketHandler
import villages.app.TestSockets.LARGE_FRAMES
import villages.protocol.ProtocolJson
import villages.protocol.RevisionRefused
import villages.protocol.ServerFrame
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit

/**
 * A message larger than a socket's eight-kilobyte buffer arrives whole, gathered from its pieces, and one past the
 * largest a connection may send closes it, as the socket's own limit did before every socket was given a buffer that
 * size (experiment 0021). The large one is a catalogue revision based on nothing, which the gateway refuses as
 * stale without writing anything, so that the answer proves the whole of it was read.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SocketPiecesTest {
    @LocalServerPort
    var port: Int = 0

    private class Window(port: Int) {
        val heard = CopyOnWriteArrayList<ServerFrame>()
        val closed = CompletableFuture<CloseStatus>()
        private val session: WebSocketSession = StandardWebSocketClient(LARGE_FRAMES)
            .execute(
                object : TextWebSocketHandler() {
                    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
                        heard += ProtocolJson.decodeServer(message.payload)
                    }

                    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
                        closed.complete(status)
                    }
                },
                "ws://localhost:$port/ws",
            )
            .get(10, TimeUnit.SECONDS)

        fun say(json: String) = session.sendMessage(TextMessage(json))
    }

    private fun revision(characters: Int): String =
        """{"type":"reviseCatalogue","catalogue":"balance","text":"${"x".repeat(characters)}","basedOn":"nothing"}"""

    @Test
    fun `a message ten times the socket's buffer arrives whole`() {
        val window = Window(port)
        window.say(revision(80_000))

        val giveUp = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
        while (window.heard.none { it is RevisionRefused } && System.nanoTime() < giveUp) Thread.sleep(20)

        val refused = window.heard.filterIsInstance<RevisionRefused>().single()
        assertEquals("balance", refused.catalogue)
        assertTrue(!window.closed.isDone, "the connection stays open")
    }

    @Test
    fun `a message past the largest a connection may send closes it`() {
        val window = Window(port)
        window.say(revision(GatewaySocket.LARGEST_MESSAGE + 1))

        assertEquals(CloseStatus.TOO_BIG_TO_PROCESS.code, window.closed.get(10, TimeUnit.SECONDS).code)
    }
}
