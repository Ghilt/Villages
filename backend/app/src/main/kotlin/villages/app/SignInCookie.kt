package villages.app

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseCookie
import villages.accounts.Keeping
import java.time.Duration

/**
 * The cookie a browser's sign-in is kept in: HttpOnly, so no script on the page can read it; SameSite=Lax, so another
 * site's form cannot send it; Secure whenever the page came over HTTPS. It carries the sign-in's secret and nothing
 * else, and lives as long as its [Keeping] says, or until the browser closes for one that is not remembered.
 *
 * **Named for the tree**, `<the tree's database>-signin`, as its database and its virtual host are (0092, 0094): a
 * cookie ignores ports, so every tree on localhost shares one cookie jar, and a cookie of one name would have every
 * tree's sign-in sign every other's out. See docs/plans/accounts.md.
 */
class SignInCookie(val name: String) {
    fun read(request: HttpServletRequest): String? = request.cookies?.firstOrNull { it.name == name }?.value

    /** The secret a request's `Cookie` header carries, for a request that is not a servlet's: the socket's handshake. */
    fun read(headers: HttpHeaders): String? =
        headers[HttpHeaders.COOKIE].orEmpty()
            .flatMap { it.split(';') }
            .map { it.trim() }
            .firstOrNull { it.startsWith("$name=") }
            ?.substringAfter('=')

    fun write(response: HttpServletResponse, request: HttpServletRequest, secret: String, keeping: Keeping) {
        val cookie = base(request, secret)
        keeping.cookie?.let(cookie::maxAge)
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.build().toString())
    }

    fun clear(response: HttpServletResponse, request: HttpServletRequest) {
        response.addHeader(HttpHeaders.SET_COOKIE, base(request, "").maxAge(Duration.ZERO).build().toString())
    }

    private fun base(request: HttpServletRequest, value: String) = ResponseCookie.from(name, value)
        .httpOnly(true)
        .secure(request.isSecure || request.getHeader("X-Forwarded-Proto") == "https")
        .sameSite("Lax")
        .path("/")
}
