package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import villages.accounts.Outbox
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse

/**
 * Adam's instruments on a server others play on: open only to the verified account of the email
 * `villages.instruments.for` names. Its outbox, the lever that lets a sign-in run out and becoming another player are
 * refused to a guest, to another account, and to that account until its email is verified, and answered after.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = ["villages.instruments.for=adam-instruments@example.com"],
)
class InstrumentsForAnAccountTest {
    @LocalServerPort
    var port: Int = 0

    @Autowired
    lateinit var outbox: Outbox

    private val http = HttpClient.newHttpClient()

    private fun send(method: String, path: String, cookie: String? = null, body: String = "{}"): HttpResponse<String> = http.send(
        HttpRequest.newBuilder(URI("http://localhost:$port$path"))
            .method(method, if (method == "GET") HttpRequest.BodyPublishers.noBody() else HttpRequest.BodyPublishers.ofString(body))
            .header("Content-Type", "application/json")
            .header("Origin", "http://localhost:5548")
            .apply { cookie?.let { header("Cookie", it) } }
            .build(),
        HttpResponse.BodyHandlers.ofString(),
    )

    private fun cookieOf(response: HttpResponse<String>): String =
        response.headers().allValues("Set-Cookie").single { it.substringBefore('=').endsWith("-signin") }.substringBefore(';')

    private fun account(email: String): String =
        cookieOf(send("POST", "/auth/signup", body = """{"email":"$email","password":"a long and quiet river"}"""))

    @Test
    fun `only the verified account the setting names is let at the instruments`() {
        val guest = cookieOf(send("POST", "/auth/guest"))
        val other = account("someone-else@example.com")
        val adam = account("adam-instruments@example.com")

        assertEquals(403, send("GET", "/auth/outbox", guest).statusCode())
        assertEquals(403, send("GET", "/auth/outbox", other).statusCode())
        assertEquals(403, send("GET", "/auth/outbox", adam).statusCode())

        val link = outbox.mail().last { it.to == "adam-instruments@example.com" }.link!!
        assertEquals(200, send("POST", "/auth/verify", body = """{"secret":"${link.substringAfter('#')}"}""").statusCode())

        assertEquals(200, send("GET", "/auth/outbox", adam).statusCode())
        assertEquals(403, send("POST", "/auth/runout", other).statusCode())
    }
}
