package villages.app

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import villages.accounts.Accounts
import villages.accounts.Keeping
import villages.accounts.Outbox
import villages.accounts.Settings
import villages.accounts.SignIn
import villages.accounts.browserOf
import villages.domain.HouseId
import villages.domain.PlayerId
import java.util.UUID

/**
 * Who a browser is, over plain HTTP under `/auth`, which the page asks before it opens the socket: the socket's
 * handshake carries the cookie these endpoints set. Every rule is the accounts'; what is here is the cookie and the
 * shapes of the answers. A request that changes something from a page not ours never gets here: [OnlyOurPages].
 * See docs/plans/accounts.md.
 */
@RestController
@RequestMapping("/auth")
class AuthEndpoints(
    private val accounts: Accounts,
    private val cookie: SignInCookie,
    private val outbox: Outbox,
    @Value("\${villages.instruments:true}") private val instrumentsOpen: Boolean,
) {
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
        return Me.of(who.signIn, guest = who.guest, settings = who.record?.settings ?: Settings())
    }

    /**
     * This player's settings that are not the game's, written whole: whether the world moves, and the language. Kept
     * for the player, so they follow an account to another browser. A browser signed in to nobody has none to write.
     */
    @PostMapping("/settings")
    fun settle(request: HttpServletRequest, @RequestBody asked: SettingsView): ResponseEntity<Any> {
        val who = cookie.read(request)?.let(accounts::who)
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("refused" to "notSignedIn"))
        val settings = runCatching { Settings(motion = asked.motion, language = asked.language) }.getOrNull()
            ?: return ResponseEntity.badRequest().body(mapOf("refused" to "notASetting"))
        accounts.settle(who.signIn.player, settings)
        return ResponseEntity.ok(Me.of(who.signIn, guest = who.guest, settings = settings))
    }

    /**
     * A newcomer: a player of their own and a guest's sign-in for this browser. A page that kept a player's id in local
     * storage before there were sign-ins says it in `adopt`, and is made a guest of that same player once, so its house
     * is still its own. A browser has one sign-in, so one it had already is ended first.
     */
    @PostMapping("/guest")
    fun guest(
        request: HttpServletRequest,
        response: HttpServletResponse,
        @RequestBody(required = false) asked: GuestAsked?,
    ): Me {
        endThisBrowsers(request)
        val browser = browserOf(request.getHeader("User-Agent"))
        val old = asked?.adopt?.let { runCatching { PlayerId(UUID.fromString(it)) }.getOrNull() }
        val begun = old?.let { accounts.adopt(it, browser) } ?: accounts.newcomer(browser)
        cookie.write(response, request, begun.secret, begun.signIn.keeping)
        return Me.of(begun.signIn, guest = true, settings = Settings())
    }

    /**
     * Adam's instrument: this browser signed in as another player, which is how the debug panel switches player and
     * arrives as the maker of a save it loaded. Refused while the instruments are closed.
     */
    @PostMapping("/become")
    fun become(request: HttpServletRequest, response: HttpServletResponse, @RequestBody asked: BecomeAsked): ResponseEntity<Any> {
        if (!instrumentsOpen) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("refused" to "instrumentsClosed"))
        }
        val player = runCatching { PlayerId(UUID.fromString(asked.player)) }.getOrNull()
            ?: return ResponseEntity.badRequest().body(mapOf("refused" to "notAPlayer"))
        endThisBrowsers(request)
        val begun = accounts.become(player, browserOf(request.getHeader("User-Agent")))
        cookie.write(response, request, begun.secret, begun.signIn.keeping)
        return ResponseEntity.ok(Me.of(begun.signIn, guest = true, settings = Settings()))
    }

    /**
     * Adam's lever, standing in for time: this browser's sign-in ends now, as one left unused past its time does, and
     * its windows are stood down. The cookie stays in the browser, as it would, and names nothing now.
     */
    @PostMapping("/runout")
    fun runOut(request: HttpServletRequest): ResponseEntity<Any> {
        if (!instrumentsOpen) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("refused" to "instrumentsClosed"))
        }
        endThisBrowsers(request)
        return ResponseEntity.ok(Me.NOBODY)
    }

    /** Every mail sent, the newest last: Adam's instrument, since it holds live links. */
    @GetMapping("/outbox")
    fun outbox(): ResponseEntity<Any> =
        if (instrumentsOpen) {
            ResponseEntity.ok(outbox.mail().map { MailView(it.to, it.subject, it.text, it.link, it.sent.toEpochMilli()) })
        } else {
            ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("refused" to "instrumentsClosed"))
        }

    /** Ends the sign-in this browser's cookie names, if it names one: a browser has one sign-in at a time. */
    private fun endThisBrowsers(request: HttpServletRequest) {
        cookie.read(request)?.let(accounts.signIns::find)?.let { accounts.signIns.end(it.id) }
    }
}

/** What a newcomer's page says: the player's id it kept in local storage before there were sign-ins, if it kept one. */
data class GuestAsked(val adopt: String? = null)

/** Which player the instruments would have this browser be. */
data class BecomeAsked(val player: String)

/** A mail sent, as the debug panel lists it. */
data class MailView(val to: String, val subject: String, val text: String, val link: String?, val sent: Long)

/** Who a browser is, as `/auth/me` answers it: a player and their house, or nobody at all. Times are milliseconds. */
data class Me(
    val player: String?,
    val house: String?,
    val guest: Boolean,
    val signIn: SignInView?,
    val settings: SettingsView,
) {
    companion object {
        val NOBODY = Me(player = null, house = null, guest = false, signIn = null, settings = SettingsView.of(Settings()))

        fun of(signIn: SignIn, guest: Boolean, settings: Settings) = Me(
            player = signIn.player.value.toString(),
            house = HouseId.of(signIn.player).value.toString(),
            guest = guest,
            signIn = SignInView(
                id = signIn.id.value.toString(),
                keeping = signIn.keeping.said,
                browser = signIn.browser,
                ends = signIn.ends.toEpochMilli(),
            ),
            settings = SettingsView.of(settings),
        )
    }
}

/** A player's settings, as the page is told them and sends them back. */
data class SettingsView(val motion: String, val language: String) {
    companion object {
        fun of(settings: Settings) = SettingsView(settings.motion, settings.language)
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
