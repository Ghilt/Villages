package villages.accounts

import villages.application.SignInId
import villages.domain.PlayerId
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * How a sign-in is kept: how long it lasts after it was last used, and how long its cookie is told to live. Adam's
 * numbers to tune, each one here and nowhere else. See docs/plans/accounts.md.
 */
enum class Keeping(val unused: Duration, val cookie: Duration?) {
    /** Remember me: until 60 days after it was last used, its cookie given its lifetime again at most once a day. */
    REMEMBERED(Duration.ofDays(60), Duration.ofDays(60)),

    /**
     * Not remembered: its cookie goes when the browser closes, and the server ends it after 12 hours unused anyway,
     * because a browser told to continue where it left off brings such a cookie back.
     */
    FOR_NOW(Duration.ofHours(12), null),

    /** A guest's: always remembered, for the longest a browser keeps a cookie, because a guest has no other way back. */
    GUEST(Duration.ofDays(400), Duration.ofDays(400)),
}

/** One browser signed in to a player. The browser holds its secret; this holds only the secret's hash. */
data class SignIn(
    val id: SignInId,
    /** [Secrets.hashOf] the secret the browser's cookie holds. */
    val hash: String,
    val player: PlayerId,
    val keeping: Keeping,
    /** What the browser said it is, as a person would name it: "Chrome on Windows". See [browserOf]. */
    val browser: String,
    val started: Instant,
    val lastUsed: Instant,
    /** When its cookie was last given its lifetime. */
    val cookieGiven: Instant,
) {
    /** When it ends, unless it is used again first. */
    val ends: Instant get() = lastUsed + keeping.unused
}

/** A sign-in just begun, and the secret its cookie is to carry: the one time the server knows the secret. */
data class Begun(val signIn: SignIn, val secret: String)

/** A sign-in that was used, as it stands now, and whether its cookie is to be given its lifetime again. */
data class Used(val signIn: SignIn, val cookieAgain: Boolean)

/**
 * The sign-ins, begun, found by their secret, used and ended. A sign-in found past its end is ended there and then,
 * so nothing hands an ended one on, and whatever [ended] tells - the gateway, which stands its windows down - hears of
 * every one that ends, however it ends. The secret is never swapped while a sign-in is used: two tabs racing to swap
 * it is the classic way remember me breaks, one tab given the new secret and the other signed out.
 */
class SignIns(private val store: SignInStore, private val clock: Clock, private val ended: (SignInId) -> Unit = {}) {
    fun begin(player: PlayerId, keeping: Keeping, browser: String): Begun {
        val secret = Secrets.fresh()
        val now = now()
        val signIn = SignIn(SignInId(UUID.randomUUID()), Secrets.hashOf(secret), player, keeping, browser, now, now, now)
        store.put(signIn)
        return Begun(signIn, secret)
    }

    /** The sign-in [secret] is, while it has not ended. */
    fun find(secret: String): SignIn? {
        val found = store.byHash(Secrets.hashOf(secret)) ?: return null
        if (found.ends.isAfter(now())) {
            return found
        }
        end(found.id)
        return null
    }

    /**
     * [signIn] used now, so it lasts from now: written at most once a minute, which is as finely as twelve hours need
     * telling. With [cookie], the use can also give the cookie its lifetime again, at most once a day.
     */
    fun use(signIn: SignIn, cookie: Boolean = false): Used {
        val now = now()
        val due = cookie && signIn.keeping.cookie != null && !signIn.cookieGiven.plus(COOKIE_AGAIN).isAfter(now)
        if (!due && signIn.lastUsed.plus(TOUCH).isAfter(now)) {
            return Used(signIn, cookieAgain = false)
        }
        val used = signIn.copy(lastUsed = now, cookieGiven = if (due) now else signIn.cookieGiven)
        store.put(used)
        return Used(used, cookieAgain = due)
    }

    fun byId(id: SignInId): SignIn? = store.byId(id)

    /** Every sign-in of [player], the newest first. */
    fun of(player: PlayerId): List<SignIn> = store.of(player).sortedByDescending { it.lastUsed }

    /** Ends [id], and says so; false when there was no such sign-in. */
    fun end(id: SignInId): Boolean = store.remove(id).also { if (it) ended(id) }

    /** Now, to the millisecond, which is as finely as MongoDB keeps a time: what is put is what is read back. */
    private fun now(): Instant = clock.instant().truncatedTo(ChronoUnit.MILLIS)

    private companion object {
        val TOUCH: Duration = Duration.ofMinutes(1)
        val COOKIE_AGAIN: Duration = Duration.ofDays(1)
    }
}

/**
 * What a browser is, as a person would name it in a list of the places they are signed in: "Chrome on Windows",
 * "Safari on an iPhone". Read from its User-Agent, which says far more and less plainly; anything not recognised is
 * "a browser", because a wrong name is worse than a vague one.
 */
fun browserOf(userAgent: String?): String {
    val said = userAgent ?: return "a browser"
    val browser = when {
        "Edg/" in said -> "Edge"
        "OPR/" in said || "Opera" in said -> "Opera"
        "Firefox/" in said || "FxiOS" in said -> "Firefox"
        "Chrome/" in said || "CriOS" in said -> "Chrome"
        "Safari/" in said -> "Safari"
        else -> "a browser"
    }
    val system = when {
        "iPhone" in said -> "an iPhone"
        "iPad" in said -> "an iPad"
        "Android" in said -> "Android"
        "Windows" in said -> "Windows"
        "Mac OS X" in said || "Macintosh" in said -> "a Mac"
        "Linux" in said -> "Linux"
        else -> null
    }
    return if (system == null) browser else "$browser on $system"
}
