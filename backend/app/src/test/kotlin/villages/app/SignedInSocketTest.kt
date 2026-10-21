package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketHttpHeaders
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.TextWebSocketHandler
import tools.jackson.databind.json.JsonMapper
import villages.app.TestSockets.LARGE_FRAMES
import villages.protocol.ErrorFrame
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.ProtocolJson
import villages.protocol.ServerFrame
import villages.protocol.Welcome
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit

/**
 * A browser's sign-in carried to the game by its socket, as a page does it: made a guest over HTTP, then a socket
 * whose handshake carries the cookie, and a hello that names nobody welcomed as that guest. A socket with no cookie is
 * nobody, and a browser that kept a player's id before there were sign-ins is that player once.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SignedInSocketTest {
    @LocalServerPort
    var port: Int = 0

    private val http = HttpClient.newHttpClient()
    private val json = JsonMapper.builder().build()

    /** A guest made for a browser, as the cookie the page would hold and the player it plays as. */
    private fun guest(body: String = "{}"): Pair<String, String> {
        val made = http.send(
            HttpRequest.newBuilder(URI("http://localhost:$port/auth/guest"))
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .header("Content-Type", "application/json")
                .header("Origin", "http://localhost:5548")
                .build(),
            HttpResponse.BodyHandlers.ofString(),
        )
        val cookie = made.headers().allValues("Set-Cookie").single { it.substringBefore('=').endsWith("-signin") }
        return cookie.substringBefore(';') to json.readTree(made.body())["player"].asString()
    }

    /** What a socket opened with [cookie] hears once it has said a hello naming nobody. */
    private fun arriving(cookie: String?): List<ServerFrame> {
        val heard = CopyOnWriteArrayList<ServerFrame>()
        val headers = WebSocketHttpHeaders().apply {
            origin = "http://localhost:5548"
            cookie?.let { add("Cookie", it) }
        }
        val session: WebSocketSession = StandardWebSocketClient(LARGE_FRAMES).execute(
            object : TextWebSocketHandler() {
                override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
                    heard += ProtocolJson.decodeServer(message.payload)
                }
            },
            headers,
            URI("ws://localhost:$port/ws"),
        ).get(10, TimeUnit.SECONDS)
        session.sendMessage(TextMessage("""{"type":"hello","protocolVersion":$PROTOCOL_VERSION}"""))
        val giveUp = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
        while (System.nanoTime() < giveUp && heard.none { it is Welcome || it is ErrorFrame }) {
            Thread.sleep(20)
        }
        session.close()
        return heard
    }

    @Test
    fun `a socket whose handshake carries a guest's cookie plays as that guest`() {
        val (cookie, player) = guest()

        assertEquals(player, arriving(cookie).filterIsInstance<Welcome>().single().playerId)
    }

    @Test
    fun `a socket with no cookie is nobody, and its hello is refused`() {
        assertEquals(listOf("notSignedIn"), arriving(cookie = null).filterIsInstance<ErrorFrame>().map { it.code })
    }

    @Test
    fun `a browser that kept a player's id before there were sign-ins is that player, once`() {
        val old = UUID.randomUUID().toString()

        val (cookie, adopted) = guest("""{"adopt":"$old"}""")
        val (_, again) = guest("""{"adopt":"$old"}""")

        assertEquals(old, adopted)
        assertEquals(old, arriving(cookie).filterIsInstance<Welcome>().single().playerId)
        assertNotEquals(old, again)
    }
}
