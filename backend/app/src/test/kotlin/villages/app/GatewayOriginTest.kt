package villages.app

import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.web.socket.WebSocketHttpHeaders
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.TextWebSocketHandler
import java.net.URI
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeUnit

/**
 * Who may open the gateway's socket: a page served from this machine, whichever port it is on.
 *
 * The main checkout's dev server is on 5173 and every worktree's is on a port of its own (decision 0031), so
 * an allow-list of one origin refused every worktree with a 403 while the server was plainly up. The
 * refusal half matters as much as the other: a client that never sent an Origin header would pass the
 * first test for the wrong reason, and only the second proves the check is there at all.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class GatewayOriginTest {
    @LocalServerPort
    var port: Int = 0

    private fun handshake(from: String) = StandardWebSocketClient()
        .execute(
            object : TextWebSocketHandler() {},
            WebSocketHttpHeaders().apply { origin = from },
            URI("ws://localhost:$port/ws"),
        )

    @Test
    fun `a page from the main checkout or from any worktree may connect`() {
        for (from in listOf("http://localhost:5173", "http://localhost:5544")) {
            val session = handshake(from).get(10, TimeUnit.SECONDS)
            assertTrue(session.isOpen, "a page from $from should be let in")
            session.close()
        }
    }

    @Test
    fun `a page from anywhere else is refused`() {
        val refused = assertThrows(ExecutionException::class.java) {
            handshake("http://example.com:5544").get(10, TimeUnit.SECONDS)
        }
        assertTrue(refused.cause?.message?.contains("403") == true, "expected a 403, got ${refused.cause}")
    }
}
