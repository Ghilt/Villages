package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertNotNull
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

/**
 * The sign-in's endpoints over real HTTP, as a page meets them: nobody at first, a guest made with a cookie the page
 * cannot read, the same guest known by that cookie afterwards, and a request from a page that is not ours refused.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AuthEndpointsTest {
    @LocalServerPort
    var port: Int = 0

    private val http = HttpClient.newHttpClient()
    private val json = JsonMapper.builder().build()

    private fun ask(path: String, cookie: String? = null): HttpResponse<String> = http.send(
        HttpRequest.newBuilder(URI("http://localhost:$port$path")).GET()
            .apply { cookie?.let { header("Cookie", it) } }
            .build(),
        HttpResponse.BodyHandlers.ofString(),
    )

    private fun post(path: String, origin: String? = "http://localhost:5548", cookie: String? = null): HttpResponse<String> =
        http.send(
            HttpRequest.newBuilder(URI("http://localhost:$port$path"))
                .POST(HttpRequest.BodyPublishers.ofString("{}"))
                .header("Content-Type", "application/json")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0 Safari/537.36")
                .apply { origin?.let { header("Origin", it) } }
                .apply { cookie?.let { header("Cookie", it) } }
                .build(),
            HttpResponse.BodyHandlers.ofString(),
        )

    private fun body(response: HttpResponse<String>): JsonNode = json.readTree(response.body())

    /** The sign-in's cookie a response sets, as `name=value`, with the rest of what it says. */
    private fun setCookie(response: HttpResponse<String>): String =
        response.headers().allValues("Set-Cookie").single { it.substringBefore('=').endsWith("-signin") }

    @Test
    fun `a browser with no cookie is nobody`() {
        val me = body(ask("/auth/me"))

        assertTrue(me["player"].isNull)
        assertFalse(me["guest"].asBoolean())
    }

    @Test
    fun `a newcomer is made a guest, with a cookie no script can read, kept four hundred days`() {
        val made = post("/auth/guest")

        assertEquals(200, made.statusCode())
        val cookie = setCookie(made)
        assertTrue(cookie.contains("HttpOnly"), cookie)
        assertTrue(cookie.contains("SameSite=Lax"), cookie)
        assertTrue(cookie.contains("Max-Age=${400 * 24 * 60 * 60}"), cookie)
        val me = body(made)
        assertTrue(me["guest"].asBoolean())
        assertEquals("guest", me["signIn"]["keeping"].asString())
        assertEquals("Chrome on Windows", me["signIn"]["browser"].asString())
    }

    @Test
    fun `the cookie says who the browser is from then on`() {
        val made = post("/auth/guest")
        val cookie = setCookie(made).substringBefore(';')

        val me = body(ask("/auth/me", cookie))

        assertEquals(body(made)["player"].asString(), me["player"].asString())
        assertNotNull(me["house"].asString())
    }

    @Test
    fun `a browser that becomes a guest again ends the sign-in it had`() {
        val first = setCookie(post("/auth/guest")).substringBefore(';')

        val second = post("/auth/guest", cookie = first)

        assertNotEquals(body(ask("/auth/me", first))["player"], body(second)["player"])
        assertTrue(body(ask("/auth/me", first))["player"].isNull)
    }

    @Test
    fun `a request from a page that is not ours is refused, and so is one that names no page`() {
        assertEquals(403, post("/auth/guest", origin = "http://example.com").statusCode())
        assertEquals(403, post("/auth/guest", origin = null).statusCode())
        assertTrue(post("/auth/guest", origin = "http://example.com").headers().allValues("Set-Cookie").isEmpty())
    }
}
