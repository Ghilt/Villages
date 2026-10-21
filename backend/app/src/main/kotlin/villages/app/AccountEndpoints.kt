package villages.app

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import villages.accounts.Accounts
import villages.accounts.Asking
import villages.accounts.Entering
import villages.accounts.Keeping
import villages.accounts.Making
import villages.accounts.browserOf
import villages.application.SignInId
import java.util.UUID

/**
 * An account, under `/auth`: made with an email and a password, signed in to and signed out of. Every rule is the
 * accounts'; what is here is the cookie and the shapes of the answers. A browser that makes an account or signs in has
 * its sign-in swapped for a new one, and the page loads again as it. See docs/plans/accounts.md.
 */
@RestController
@RequestMapping("/auth")
class AccountEndpoints(private val accounts: Accounts, private val cookie: SignInCookie) {
    /**
     * An account made, and this browser signed in to it: a guest's own player becomes it, house and all. An email with
     * an account already is mailed to say so and nothing changes, so the answer is who the browser was before, and the
     * page says a mail is on its way. Its shape is the same either way; that the browser is not signed in to the email
     * shows whose it was, which the limit on asking keeps from being a way to harvest emails.
     */
    @PostMapping("/signup")
    fun signUp(request: HttpServletRequest, response: HttpServletResponse, @RequestBody asked: EmailAsked): ResponseEntity<Any> {
        val current = currentOf(request)
        return when (val made = accounts.makeAccount(asked.email, asked.password, keepingOf(asked), current, askingOf(request))) {
            is Making.Made -> {
                cookie.write(response, request, made.begun.secret, made.begun.signIn.keeping)
                ResponseEntity.ok(Me.of(made.begun.signIn, accounts.recordOf(made.begun.signIn.player)))
            }
            Making.Taken -> ResponseEntity.ok(current?.let { Me.of(it, accounts.recordOf(it.player)) } ?: Me.NOBODY)
            is Making.Refused -> ResponseEntity.badRequest().body(refused(made.why))
        }
    }

    /** This browser signed in to the account the email is kept under, if the password is its. */
    @PostMapping("/signin")
    fun signIn(request: HttpServletRequest, response: HttpServletResponse, @RequestBody asked: EmailAsked): ResponseEntity<Any> =
        when (val entering = accounts.signInWith(asked.email, asked.password, keepingOf(asked), currentOf(request), askingOf(request))) {
            is Entering.In -> {
                cookie.write(response, request, entering.begun.secret, entering.begun.signIn.keeping)
                ResponseEntity.ok(Me.of(entering.begun.signIn, accounts.recordOf(entering.begun.signIn.player)))
            }
            Entering.NotThatPassword -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(refused("notThatPassword"))
            Entering.TooMany -> ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(refused("tooMany"))
        }

    /**
     * This browser signed out: its sign-in ended on the server, so a copied cookie stops working too, its windows stood
     * down, and its cookie cleared. A guest who signs out has lost the house, which the page says first.
     */
    @PostMapping("/signout")
    fun signOut(request: HttpServletRequest, response: HttpServletResponse): Me {
        currentOf(request)?.let { accounts.signIns.end(it.id) }
        cookie.clear(response, request)
        return Me.NOBODY
    }

    /** The email a mailed link was sent to, verified, if the link's secret is one that has not been used or ended. */
    @PostMapping("/verify")
    fun verify(@RequestBody asked: SecretAsked): ResponseEntity<Any> =
        if (accounts.verify(asked.secret)) {
            ResponseEntity.ok(mapOf("verified" to true))
        } else {
            ResponseEntity.badRequest().body(refused("linkUsedOrOld"))
        }

    /** The link that verifies this browser's account's email mailed again, only the newest working. */
    @PostMapping("/verify/again")
    fun verifyAgain(request: HttpServletRequest): ResponseEntity<Any> {
        val current = currentOf(request) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(refused("notSignedIn"))
        return if (accounts.mailVerifyingAgain(current, askingOf(request))) {
            ResponseEntity.ok(mapOf("mailed" to true))
        } else {
            ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(refused("tooMany"))
        }
    }

    /** A link to choose a new password mailed to the account of an email, if it has one; the same answer either way. */
    @PostMapping("/forgot")
    fun forgot(request: HttpServletRequest, @RequestBody asked: ForgotAsked): Map<String, Boolean> {
        accounts.forgot(asked.email, askingOf(request))
        return mapOf("mailedIfAnAccount" to true)
    }

    /**
     * A new password chosen through a mailed link: every sign-in of the account ended, and this browser signed in to it
     * anew, remembered unless unticked.
     */
    @PostMapping("/reset")
    fun reset(request: HttpServletRequest, response: HttpServletResponse, @RequestBody asked: ResetAsked): ResponseEntity<Any> =
        signedInBy(request, response, accounts.reset(asked.secret, asked.password, keepingOf(asked.remember), currentOf(request), askingOf(request)))

    /** This account's password changed: every other browser signed out of it, and this one given a new secret. */
    @PostMapping("/password")
    fun changePassword(request: HttpServletRequest, response: HttpServletResponse, @RequestBody asked: PasswordAsked): ResponseEntity<Any> {
        val current = currentOf(request) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(refused("notSignedIn"))
        return signedInBy(request, response, accounts.changePassword(current, asked.was, asked.password, askingOf(request)))
    }

    /** Every browser signed in to this player, the newest used first, this one marked. */
    @GetMapping("/signins")
    fun signIns(request: HttpServletRequest): ResponseEntity<Any> {
        val current = currentOf(request) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(refused("notSignedIn"))
        return ResponseEntity.ok(
            accounts.signIns.of(current.player).map {
                SignInRow(it.id.value.toString(), it.browser, it.keeping.said, it.lastUsed.toEpochMilli(), it.ends.toEpochMilli(), it.id == current.id)
            },
        )
    }

    /** One of this player's sign-ins ended, and its windows stood down: *sign out there*. */
    @PostMapping("/signins/out")
    fun signOutThere(request: HttpServletRequest, @RequestBody asked: SignInAsked): ResponseEntity<Any> {
        val current = currentOf(request) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(refused("notSignedIn"))
        val there = runCatching { SignInId(UUID.fromString(asked.id)) }.getOrNull()?.let(accounts.signIns::byId)
            ?.takeIf { it.player == current.player }
            ?: return ResponseEntity.badRequest().body(refused("notYours"))
        accounts.signIns.end(there.id)
        return ResponseEntity.ok(mapOf("ended" to true))
    }

    /** Every sign-in of this player's ended but this browser's, and their windows stood down. */
    @PostMapping("/signins/others-out")
    fun signOutEverywhereElse(request: HttpServletRequest): ResponseEntity<Any> {
        val current = currentOf(request) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(refused("notSignedIn"))
        accounts.signIns.endEveryOther(current.player, kept = current.id)
        return ResponseEntity.ok(mapOf("ended" to true))
    }

    /** What making a sign-in came to, answered: the new cookie and who it is, or the refusal. */
    private fun signedInBy(request: HttpServletRequest, response: HttpServletResponse, made: Making): ResponseEntity<Any> =
        when (made) {
            is Making.Made -> {
                cookie.write(response, request, made.begun.secret, made.begun.signIn.keeping)
                ResponseEntity.ok(Me.of(made.begun.signIn, accounts.recordOf(made.begun.signIn.player)))
            }
            Making.Taken -> ResponseEntity.badRequest().body(refused("taken"))
            is Making.Refused -> ResponseEntity.badRequest().body(refused(made.why))
        }

    private fun currentOf(request: HttpServletRequest) = cookie.read(request)?.let(accounts.signIns::find)

    /** Where the request came from: its browser, its address, and the page that sent it, which a mailed link opens. */
    private fun askingOf(request: HttpServletRequest) =
        Asking(browserOf(request), request.remoteAddr, request.getHeader("Origin") ?: "http://localhost")

    private fun keepingOf(asked: EmailAsked) = keepingOf(asked.remember)

    private fun keepingOf(remember: Boolean) = if (remember) Keeping.REMEMBERED else Keeping.FOR_NOW

    private fun browserOf(request: HttpServletRequest) = browserOf(request.getHeader("User-Agent"))
}

/** A mailed link's secret, as the page it opened sends it on. */
data class SecretAsked(val secret: String)

/** One of a player's sign-ins, as the settings list them: where, how kept, when last used and when it ends. */
data class SignInRow(val id: String, val browser: String, val keeping: String, val lastUsed: Long, val ends: Long, val here: Boolean)

/** Which sign-in to end. */
data class SignInAsked(val id: String)

/** The email whose account has forgotten its password. */
data class ForgotAsked(val email: String)

/** A new password chosen through a mailed link's secret, and whether to remember this browser. */
data class ResetAsked(val secret: String, val password: String, val remember: Boolean = true)

/** The password an account has, and the one it is to have. */
data class PasswordAsked(val was: String, val password: String)

/** An email and a password, as a form sends them, and whether to remember this browser: ticked unless unticked. */
data class EmailAsked(val email: String, val password: String, val remember: Boolean = true)
