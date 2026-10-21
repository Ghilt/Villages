package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID

/**
 * Signing in through Google, the whole way round over real HTTP, through the pretend Google a tree has: sent there,
 * an identity chosen on its page, sent back with a code, which Spring Security's client trades for a token and the
 * token for the identity, as it does with the real one, and this browser signed in to an account of it. A guest who
 * goes round keeps their house.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = ["villages.oauth=pretend"])
class SignInElsewhereTest {
    @LocalServerPort
    var port: Int = 0

    private val http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build()
    private val json = JsonMapper.builder().build()

    /** The cookies a browser holds, as name to value, given by every answer. */
    private class Jar {
        val cookies = LinkedHashMap<String, String>()

        fun header(): String = cookies.entries.joinToString("; ") { "${it.key}=${it.value}" }

        fun keep(response: HttpResponse<*>) {
            for (set in response.headers().allValues("Set-Cookie")) {
                val pair = set.substringBefore(';')
                cookies[pair.substringBefore('=')] = pair.substringAfter('=')
            }
        }
    }

    private fun send(jar: Jar, request: HttpRequest.Builder): HttpResponse<String> =
        http.send(request.apply { if (jar.cookies.isNotEmpty()) header("Cookie", jar.header()) }.build(), HttpResponse.BodyHandlers.ofString())
            .also(jar::keep)

    private fun get(jar: Jar, path: String) = send(jar, HttpRequest.newBuilder(URI(absolute(path))).GET())

    private fun absolute(path: String) = if (path.startsWith("http")) path else "http://localhost:$port$path"

    private fun me(jar: Jar): JsonNode = json.readTree(get(jar, "/auth/me").body())

    /** Round Google as [email], from a browser holding [jar]: what `/auth/me` says after. */
    private fun throughGoogle(jar: Jar, email: String): JsonNode {
        val sent = get(jar, "/oauth2/authorization/google")
        assertEquals(302, sent.statusCode())
        val asking = URI(absolute(sent.headers().firstValue("Location").get()))
        assertTrue(asking.path == "/pretend/google/authorize", asking.toString())
        val query = asking.rawQuery.split('&').associate { it.substringBefore('=') to java.net.URLDecoder.decode(it.substringAfter('='), Charsets.UTF_8) }
        val page = get(jar, asking.toString())
        assertEquals(200, page.statusCode())
        // Its form is sent to its own path and not to the address it was opened at, whose query would come twice.
        assertTrue(page.body().contains("<form method=\"post\" action=\"authorize\">"), page.body())

        val form = mapOf("email" to email, "verified" to "yes", "redirect_uri" to query.getValue("redirect_uri"), "state" to query.getValue("state"))
            .entries.joinToString("&") { "${it.key}=${URLEncoder.encode(it.value, Charsets.UTF_8)}" }
        val chosen = send(
            jar,
            HttpRequest.newBuilder(URI(absolute("/pretend/google/authorize")))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form)),
        )
        assertEquals(302, chosen.statusCode())

        val back = get(jar, chosen.headers().firstValue("Location").get())
        assertEquals(302, back.statusCode(), back.body())
        assertEquals("/", URI(absolute(back.headers().firstValue("Location").get())).path)
        return me(jar)
    }

    @Test
    fun `a browser goes round the pretend Google and comes back signed in to an account of that identity`() {
        val email = "ada-${UUID.randomUUID()}@example.com"

        val me = throughGoogle(Jar(), email)

        assertEquals(email, me["email"].asString())
        assertTrue(me["verified"].asBoolean())
        assertEquals(1, me["through"].size())
        assertEquals("google", me["through"][0].asString())
    }

    @Test
    fun `a guest who goes round keeps their house, and the same identity is the same account next time`() {
        val jar = Jar()
        val guest = json.readTree(
            send(
                jar,
                HttpRequest.newBuilder(URI(absolute("/auth/guest")))
                    .header("Origin", "http://localhost:5548")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString("{}")),
            ).body(),
        )
        val email = "babbage-${UUID.randomUUID()}@example.com"

        assertEquals(guest["player"].asString(), throughGoogle(jar, email)["player"].asString())
        assertEquals(guest["player"].asString(), throughGoogle(Jar(), email)["player"].asString())
    }
}
