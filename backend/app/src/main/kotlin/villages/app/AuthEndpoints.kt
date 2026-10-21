package villages.app

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import villages.accounts.Accounts
import villages.accounts.Keeping
import villages.accounts.SignIn
import villages.accounts.browserOf
import villages.domain.HouseId

/**
 * Who a browser is, over plain HTTP under `/auth`, which the page asks before it opens the socket: the socket's
 * handshake carries the cookie these endpoints set. Every rule is the accounts'; what is here is the cookie and the
 * shapes of the answers. A request that changes something from a page not ours never gets here: [OnlyOurPages].
 * See docs/plans/accounts.md.
 */
@RestController
@RequestMapping("/auth")
class AuthEndpoints(private val accounts: Accounts, private val cookie: SignInCookie) {
    /**
     * Who this browser is signed in as, or nobody. Asked at every load, which is what keeps a remembered sign-in's
     * cookie alive: given its lifetime again here at most once a day.
     */
    @GetMapping("/me")
    fun me(request: HttpServletRequest, response: HttpServletResponse): Me {
        val secret = cookie.read(request) ?: return Me.NOBODY
        val who = accounts.who(secret, cookie = true)
        if (who == null) {
            cookie.clear(response, request)
            return Me.NOBODY
        }
        if (who.cookieAgain) {
            cookie.write(response, request, secret, who.signIn.keeping)
        }
        return Me.of(who.signIn, guest = who.guest)
    }

    /**
     * A newcomer: a player of their own and a guest's sign-in for this browser. A browser has one sign-in, so one it
     * had already is ended first.
     */
    @PostMapping("/guest")
    fun guest(request: HttpServletRequest, response: HttpServletResponse): Me {
        cookie.read(request)?.let(accounts.signIns::find)?.let { accounts.signIns.end(it.id) }
        val begun = accounts.newcomer(browserOf(request.getHeader("User-Agent")))
        cookie.write(response, request, begun.secret, begun.signIn.keeping)
        return Me.of(begun.signIn, guest = true)
    }
}

/** Who a browser is, as `/auth/me` answers it: a player and their house, or nobody at all. Times are milliseconds. */
data class Me(val player: String?, val house: String?, val guest: Boolean, val signIn: SignInView?) {
    companion object {
        val NOBODY = Me(player = null, house = null, guest = false, signIn = null)

        fun of(signIn: SignIn, guest: Boolean) = Me(
            player = signIn.player.value.toString(),
            house = HouseId.of(signIn.player).value.toString(),
            guest = guest,
            signIn = SignInView(
                id = signIn.id.value.toString(),
                keeping = signIn.keeping.said,
                browser = signIn.browser,
                ends = signIn.ends.toEpochMilli(),
            ),
        )
    }
}

/** A sign-in, as the page is told of it: how it is kept, in the page's words, and when it ends unless used again. */
data class SignInView(val id: String, val keeping: String, val browser: String, val ends: Long)

/** How a [Keeping] is said on the page's side of `/auth`. */
internal val Keeping.said: String
    get() = when (this) {
        Keeping.REMEMBERED -> "remembered"
        Keeping.FOR_NOW -> "forNow"
        Keeping.GUEST -> "guest"
    }
