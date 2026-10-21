package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID

/**
 * Adam's instruments under `/auth`, on a server that runs them closed: becoming another player, letting a sign-in run
 * out and reading the outbox are each refused, and a newcomer is still made a guest, because that is a player's.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = ["villages.instruments=false"])
class AuthInstrumentsClosedTest {
    @LocalServerPort
    var port: Int = 0

    private val http = HttpClient.newHttpClient()

    private fun send(method: String, path: String, body: String = "{}"): HttpResponse<String> = http.send(
        HttpRequest.newBuilder(URI("http://localhost:$port$path"))
            .method(method, if (method == "GET") HttpRequest.BodyPublishers.noBody() else HttpRequest.BodyPublishers.ofString(body))
            .header("Content-Type", "application/json")
            .header("Origin", "http://localhost:5548")
            .build(),
        HttpResponse.BodyHandlers.ofString(),
    )

    @Test
    fun `every instrument is refused while they are closed, and a newcomer is still made a guest`() {
        assertEquals(403, send("POST", "/auth/become", """{"player":"${UUID.randomUUID()}"}""").statusCode())
        assertEquals(403, send("POST", "/auth/runout").statusCode())
        assertEquals(403, send("GET", "/auth/outbox").statusCode())
        assertEquals(200, send("POST", "/auth/guest").statusCode())
    }
}
