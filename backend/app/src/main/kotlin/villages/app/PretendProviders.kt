package villages.app

import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.util.HtmlUtils
import org.springframework.web.util.UriComponentsBuilder
import villages.accounts.Secrets
import java.net.URI
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * A pretend Google and a pretend Discord, answered by this game server, so signing in through them can be tried on
 * every tree although the real ones send a player back only to a port registered with them. Its page asks which
 * made-up identity to be - an email, and whether it is verified - and the rest is OAuth2 as the real ones speak it:
 * a code sent back to the game, a token for the code, and the identity for the token, which Spring Security's client
 * asks for exactly as it asks Google. Adam's instrument, answered only while `SigningInElsewhere` is pretending. See
 * docs/plans/accounts.md.
 */
@RestController
@RequestMapping("/pretend/{provider}")
class PretendProviders(private val elsewhere: SigningInElsewhere) {
    private data class Identity(val provider: String, val email: String, val verified: Boolean)

    private val codes = ConcurrentHashMap<String, Identity>()
    private val tokens = ConcurrentHashMap<String, Identity>()

    /** The pretend provider's page: which made-up identity to sign in as. */
    @GetMapping("/authorize", produces = [MediaType.TEXT_HTML_VALUE])
    fun asking(
        @PathVariable provider: String,
        @RequestParam("redirect_uri") back: String,
        @RequestParam state: String,
    ): ResponseEntity<String> {
        if (!pretending(provider) || !isOurs(back)) return ResponseEntity.status(HttpStatus.NOT_FOUND).build()
        val name = provider.replaceFirstChar(Char::uppercase)
        val page = """
            <!doctype html><html lang="en"><head><meta charset="utf-8"><title>Pretend $name</title>
            <style>body{font:16px system-ui;background:#1c1813;color:#ebe3d1;display:grid;place-items:center;min-height:100vh;margin:0}
            form{background:#27211a;padding:2rem;border:1px solid #af8966;display:grid;gap:.75rem;width:min(24rem,90vw)}
            input[type=email]{font:inherit;padding:.4rem}button{font:inherit;padding:.5rem}</style></head>
            <body><form method="post" action="authorize">
            <h1>Pretend $name</h1>
            <p>Not the real $name: a stand-in on this game server, so signing in through $name can be tried on any tree.
            Sign in as a made-up identity.</p>
            <label>Email <input type="email" name="email" value="someone@example.com" required></label>
            <label><input type="checkbox" name="verified" value="yes" checked> $name says it has verified the email</label>
            <input type="hidden" name="redirect_uri" value="${HtmlUtils.htmlEscape(back)}">
            <input type="hidden" name="state" value="${HtmlUtils.htmlEscape(state)}">
            <button type="submit">Continue as this identity</button>
            </form></body></html>
        """.trimIndent()
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(page)
    }

    /** The identity chosen: a code for it sent back to the game, as the real provider sends one. */
    @PostMapping("/authorize")
    fun chosen(
        @PathVariable provider: String,
        @RequestParam email: String,
        @RequestParam(required = false) verified: String?,
        @RequestParam("redirect_uri") back: String,
        @RequestParam state: String,
        response: HttpServletResponse,
    ) {
        if (!pretending(provider) || !isOurs(back)) {
            response.sendError(HttpStatus.NOT_FOUND.value())
            return
        }
        val code = Secrets.fresh()
        codes[code] = Identity(provider, email.trim(), verified == "yes")
        response.sendRedirect(UriComponentsBuilder.fromUriString(back).queryParam("code", code).queryParam("state", state).build().toUriString())
    }

    /** A token for a code, which works once, as Spring's client asks the real provider for one. */
    @PostMapping("/token", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun token(@PathVariable provider: String, @RequestParam code: String): ResponseEntity<Any> {
        val identity = codes.remove(code)?.takeIf { pretending(provider) && it.provider == provider }
            ?: return ResponseEntity.badRequest().body(mapOf("error" to "invalid_grant"))
        val token = Secrets.fresh()
        tokens[token] = identity
        return ResponseEntity.ok(mapOf("access_token" to token, "token_type" to "Bearer", "expires_in" to 3600, "scope" to "email"))
    }

    /** The identity a token is for, in the shape the real provider gives it: Google's, or Discord's. */
    @GetMapping("/userinfo", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun userinfo(@PathVariable provider: String, @RequestHeader("Authorization") authorization: String): ResponseEntity<Any> {
        val identity = tokens[authorization.removePrefix("Bearer ").trim()]?.takeIf { pretending(provider) && it.provider == provider }
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()
        // The same made-up email is the same identity every time, as a real account there is.
        val subject = UUID.nameUUIDFromBytes("villages:pretend:$provider:${identity.email.lowercase()}".toByteArray()).toString()
        return ResponseEntity.ok(
            if (provider == "google") {
                mapOf("sub" to subject, "email" to identity.email, "email_verified" to identity.verified, "name" to identity.email)
            } else {
                mapOf("id" to subject, "email" to identity.email, "verified" to identity.verified, "username" to identity.email)
            },
        )
    }

    private fun pretending(provider: String) = elsewhere.pretend && provider in PROVIDERS

    /** Whether [back] is one of our pages, so the pretend provider sends nobody anywhere else. */
    private fun isOurs(back: String): Boolean = runCatching { URI(back) }.getOrNull()
        ?.let { isOurPage("${it.scheme}://${it.host}${if (it.port == -1) "" else ":${it.port}"}") } == true
}
