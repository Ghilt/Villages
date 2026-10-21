package villages.app

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.filter.OncePerRequestFilter

/**
 * Where a page of the game may be served from: this machine, on whichever port, because the main checkout's dev
 * server is on 5173 and every worktree's on a port of its own (decision 0031). The socket is held to it by its origin
 * pattern, and every `/auth` request that changes something by [OnlyOurPages].
 */
internal const val OUR_PAGES = "http://localhost:[*]"

private val OUR_PAGE = Regex("""http://localhost(:\d{1,5})?""")

/** Whether [origin] is one of [OUR_PAGES]. */
internal fun isOurPage(origin: String): Boolean = OUR_PAGE.matches(origin)

/**
 * Refuses a forged request: one that would change a sign-in, sent from a page that is not ours. A browser says which
 * page sent a request in its `Origin` header and no script can say otherwise, so a request that changes something
 * and names another page, or none, is refused before it reaches an endpoint. With the cookie SameSite=Lax, which
 * another site's form does not send, it is the whole of the defence, and simpler to see whole than Spring Security's
 * tokens a page would have to read and send back. Asking leaves nothing changed, so a GET is let through.
 */
internal class OnlyOurPages : OncePerRequestFilter() {
    override fun shouldNotFilter(request: HttpServletRequest): Boolean =
        request.method in ASKING || !request.requestURI.startsWith("/auth/")

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val origin = request.getHeader("Origin")
        if (origin != null && isOurPage(origin)) {
            chain.doFilter(request, response)
            return
        }
        response.status = HttpStatus.FORBIDDEN.value()
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.writer.write("""{"refused":"notOurPage"}""")
    }

    private companion object {
        val ASKING = setOf("GET", "HEAD", "OPTIONS")
    }
}
