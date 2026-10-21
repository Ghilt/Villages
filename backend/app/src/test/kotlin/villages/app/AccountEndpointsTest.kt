package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID

/**
 * An account over real HTTP, as the page meets it: a guest makes one and is the same player, a browser signs in to it
 * remembered or not, a wrong password is refused, and signing out ends the sign-in so its cookie names nothing.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AccountEndpointsTest {
    @LocalServerPort
    var port: Int = 0

    private val http = HttpClient.newHttpClient()
    private val json = JsonMapper.builder().build()
    private val password = "a long and quiet river"

    private fun post(path: String, body: String = "{}", cookie: String? = null): HttpResponse<String> = http.send(
        HttpRequest.newBuilder(URI("http://localhost:$port$path"))
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .header("Content-Type", "application/json")
            .header("Origin", "http://localhost:5548")
            .apply { cookie?.let { header("Cookie", it) } }
            .build(),
        HttpResponse.BodyHandlers.ofString(),
    )

    private fun me(cookie: String): JsonNode = json.readTree(
        http.send(
            HttpRequest.newBuilder(URI("http://localhost:$port/auth/me")).header("Cookie", cookie).GET().build(),
            HttpResponse.BodyHandlers.ofString(),
        ).body(),
    )

    private fun setCookie(response: HttpResponse<String>): String =
        response.headers().allValues("Set-Cookie").single { it.substringBefore('=').endsWith("-signin") }

    private fun asked(email: String, remember: Boolean = true, password: String = this.password) =
        """{"email":"$email","password":"$password","remember":$remember}"""

    private fun anEmail() = "ada-${UUID.randomUUID()}@example.com"

    @Test
    fun `a guest who makes an account is the same player, signed in to it, remembered sixty days`() {
        val guest = post("/auth/guest")
        val player = json.readTree(guest.body())["player"].asString()
        val email = anEmail()

        val made = post("/auth/signup", asked(email), setCookie(guest).substringBefore(';'))

        assertEquals(200, made.statusCode())
        assertTrue(setCookie(made).contains("Max-Age=${60 * 24 * 60 * 60}"), setCookie(made))
        val now = me(setCookie(made).substringBefore(';'))
        assertEquals(player, now["player"].asString())
        assertEquals(email, now["email"].asString())
        assertFalse(now["guest"].asBoolean())
        assertFalse(now["verified"].asBoolean())
    }

    @Test
    fun `signed in not remembered, the cookie goes with the browser`() {
        val email = anEmail()
        post("/auth/signup", asked(email))

        val entered = post("/auth/signin", asked(email, remember = false))

        assertEquals(200, entered.statusCode())
        assertFalse(setCookie(entered).contains("Max-Age"), setCookie(entered))
        assertEquals("forNow", me(setCookie(entered).substringBefore(';'))["signIn"]["keeping"].asString())
    }

    @Test
    fun `a wrong password and an email nobody has are refused alike, and a password that will not do is said`() {
        val email = anEmail()
        post("/auth/signup", asked(email))

        val wrong = post("/auth/signin", asked(email, password = "a long and quiet rivet"))
        val nobody = post("/auth/signin", asked(anEmail()))

        assertEquals(401, wrong.statusCode())
        assertEquals(wrong.body(), nobody.body())
        assertEquals("""{"refused":"short"}""", post("/auth/signup", asked(anEmail(), password = "too short")).body())
    }

    @Test
    fun `signing out ends the sign-in on the server, so the cookie names nobody`() {
        val email = anEmail()
        val cookie = setCookie(post("/auth/signup", asked(email))).substringBefore(';')

        post("/auth/signout", cookie = cookie)

        assertTrue(me(cookie)["player"].isNull)
    }
}
