package villages.accounts

import villages.application.SignInId
import villages.application.SignedIn
import villages.application.SignedInPlayers
import villages.domain.PlayerId
import java.time.Clock
import java.time.Duration
import java.util.UUID

/**
 * The accounts, as the web server's endpoints and the socket's handshake ask them things: who a browser is, and a
 * newcomer made a guest. Every rule of who may be whom is here, so the endpoints only read and write cookies. See
 * docs/plans/accounts.md.
 */
class Accounts(
    private val stores: AccountStores,
    private val clock: Clock,
    private val newPlayer: () -> PlayerId = { PlayerId(UUID.randomUUID()) },
    /** Told of every sign-in that ends, however it ends: the gateway, which stands its windows down. */
    ended: (SignInId) -> Unit = {},
    /** Where the mail goes: the outbox, in development. */
    private val mailer: Mailer = Mailer {},
) : SignedInPlayers {
    val signIns = SignIns(stores.signIns, clock, ended)

    /** A password guessed for one email, or from one address: five tries in a quarter of an hour, and twenty. */
    private val guessed = Attempts(clock, most = 5, within = Duration.ofMinutes(15))
    private val guessing = Attempts(clock, most = 20, within = Duration.ofMinutes(15))

    /** Accounts asked for from one address: ten in an hour. */
    private val making = Attempts(clock, most = 10, within = Duration.ofHours(1))

    /** Links mailed again for one player: three in an hour. */
    private val mailing = Attempts(clock, most = 3, within = Duration.ofHours(1))

    private val links = MailedLinks(stores.links, clock)

    /** Where the accounts are kept, as the debug panel says it. */
    val keptIn: String get() = stores.keptIn

    /**
     * A newcomer, from the browser [browser] names: a player of their own, who is never a secret, and a guest's
     * sign-in for that browser, which is always remembered. Play goes on as it always has.
     */
    fun newcomer(browser: String): Begun {
        val player = newPlayer()
        stores.players.add(PlayerRecord(player, clock.instant()))
        return signIns.begin(player, Keeping.GUEST, browser)
    }

    /**
     * A browser that played before there were sign-ins, by the id it kept in local storage: made a guest of that same
     * player, so the house it founded is still its own. Once only, and only for a player nobody is signed in as yet:
     * every player signed in has a record, so a record already there refuses it, and null says so.
     */
    fun adopt(old: PlayerId, browser: String): Begun? {
        if (!stores.players.add(PlayerRecord(old, clock.instant()))) {
            return null
        }
        return signIns.begin(old, Keeping.GUEST, browser)
    }

    /**
     * Adam's instrument, never a player's: this browser signed in as [player], whoever that is, which is how switching
     * player and loading a save arrive as somebody else. The endpoint refuses it while the instruments are closed.
     */
    fun become(player: PlayerId, browser: String): Begun {
        stores.players.add(PlayerRecord(player, clock.instant()))
        return signIns.begin(player, Keeping.REMEMBERED, browser)
    }

    /**
     * An account made with [asked] and [password], and this browser, whose sign-in is [current], signed in to it,
     * kept as [keeping] says. A guest's own player becomes the account, so its house is kept; anyone else gets a
     * player of their own. An email with an account already is mailed to say so and nothing else changes, and the
     * answer to the asker is the same either way. A made account's email is mailed a link to verify it. One address
     * may ask so many times.
     */
    fun makeAccount(asked: String, password: String, keeping: Keeping, current: SignIn?, asking: Asking): Making {
        val email = emailOf(asked) ?: return Making.Refused("notAnEmail")
        Passwords.problemWith(password, email)?.let { return Making.Refused(it) }
        if (!making.allowed(asking.from)) return Making.Refused("tooMany")
        making.failed(asking.from)
        val guest = current?.let { stores.players.of(it.player) }?.takeIf { it.guest }
        val record = (guest ?: PlayerRecord(newPlayer(), clock.instant()))
            .copy(email = email, verified = false, password = Passwords.hash(password))
        if (stores.players.byEmail(email) != null || !stores.players.claim(record)) {
            mailer.send(Letters.alreadyAnAccount(email, clock.instant()))
            return Making.Taken
        }
        mailer.send(Letters.verify(email, links.issue(LinkKind.VERIFY, record, asking.page), clock.instant()))
        return Making.Made(signIns.swap(current?.id, record.player, keeping, asking.browser))
    }

    /** The email a verifying link was mailed to, verified, if [secret] is one that has not been used or ended. */
    fun verify(secret: String): Boolean {
        val link = links.take(LinkKind.VERIFY, secret) ?: return false
        val record = stores.players.of(link.player)?.takeIf { it.email == link.email } ?: return false
        stores.players.put(record.copy(verified = true))
        return true
    }

    /**
     * A verifying link mailed again to the email of [current]'s account, which only the newest works, three times an
     * hour at most; false when there is nothing to verify, or too many have been asked for.
     */
    fun mailVerifyingAgain(current: SignIn, asking: Asking): Boolean {
        val record = stores.players.of(current.player)?.takeIf { !it.guest && !it.verified } ?: return false
        val key = record.player.value.toString()
        if (!mailing.allowed(key)) return false
        mailing.failed(key)
        mailer.send(Letters.verify(record.email!!, links.issue(LinkKind.VERIFY, record, asking.page), clock.instant()))
        return true
    }

    /**
     * This browser, whose sign-in is [current], signed in to the account kept under [asked], if [password] is its,
     * kept as [keeping] says. Whatever it was signed in as before is left: a guest's house is left behind with it,
     * which the page says first. A wrong password and an email nobody has are answered alike and as slowly, and so
     * many tries for one email, or from one address, are refused for a quarter of an hour.
     */
    fun signInWith(asked: String, password: String, keeping: Keeping, current: SignIn?, asking: Asking): Entering {
        val email = emailOf(asked) ?: asked.trim().lowercase()
        if (!guessed.allowed(email) || !guessing.allowed(asking.from)) return Entering.TooMany
        val record = stores.players.byEmail(email)
        if (record == null || !Passwords.matches(password, record.password)) {
            if (record == null) Passwords.matches(password, null)
            guessed.failed(email)
            guessing.failed(asking.from)
            return Entering.NotThatPassword
        }
        guessed.forget(email)
        return Entering.In(signIns.swap(current?.id, record.player, keeping, asking.browser))
    }

    /**
     * A link to choose a new password mailed to the account kept under [asked], if there is one, three times an hour at
     * most; and nothing at all otherwise. The asker is told the same either way, so it says nothing of who plays.
     */
    fun forgot(asked: String, asking: Asking) {
        val record = emailOf(asked)?.let(stores.players::byEmail) ?: return
        val key = record.player.value.toString()
        if (!mailing.allowed(key)) return
        mailing.failed(key)
        mailer.send(Letters.reset(record.email!!, links.issue(LinkKind.RESET, record, asking.page), clock.instant()))
    }

    /**
     * A new password chosen through a mailed link's [secret]: kept, the email verified, since the link reached it, every
     * sign-in of the account ended, and this browser, whose sign-in is [current], signed in to it anew. A password that
     * will not do is refused before the link is used, so the link can be tried again.
     */
    fun reset(secret: String, password: String, keeping: Keeping, current: SignIn?, asking: Asking): Making {
        val known = stores.links.peek(Secrets.hashOf(secret))
        if (known != null) Passwords.problemWith(password, known.email)?.let { return Making.Refused(it) }
        val link = links.take(LinkKind.RESET, secret) ?: return Making.Refused("linkUsedOrOld")
        val record = stores.players.of(link.player)?.takeIf { it.email == link.email } ?: return Making.Refused("linkUsedOrOld")
        stores.players.put(record.copy(password = Passwords.hash(password), verified = true))
        signIns.endEveryOther(record.player, kept = null)
        return Making.Made(signIns.swap(current?.id, record.player, keeping, asking.browser))
    }

    /**
     * [current]'s account's password changed from [was] to [password]: every other sign-in of the account ended, and
     * this one swapped for a new secret. [was] is guessed as a sign-in's password is, so many times and no more.
     */
    fun changePassword(current: SignIn, was: String, password: String, asking: Asking): Making {
        val record = stores.players.of(current.player)?.takeIf { !it.guest } ?: return Making.Refused("notSignedIn")
        if (!guessed.allowed(record.email!!) || !guessing.allowed(asking.from)) return Making.Refused("tooMany")
        if (!Passwords.matches(was, record.password)) {
            guessed.failed(record.email)
            guessing.failed(asking.from)
            return Making.Refused("notThatPassword")
        }
        Passwords.problemWith(password, record.email)?.let { return Making.Refused(it) }
        stores.players.put(record.copy(password = Passwords.hash(password)))
        signIns.endEveryOther(record.player, kept = current.id)
        return Making.Made(signIns.swap(current.id, record.player, current.keeping, asking.browser))
    }

    /**
     * This browser, whose sign-in is [current], signed in through Google or Discord as [login], which said its email
     * and whether it had verified it. The account [login] already signs in to, if any; else the account whose email it
     * is, when both have verified it, which [login] then joins; else this guest's own player, house and all; else a
     * player of their own. A verified email nobody holds is kept as the account's, verified.
     */
    fun signInThrough(login: Login, email: String?, verified: Boolean, current: SignIn?, asking: Asking): Begun {
        stores.players.byLogin(login)?.let { return signIns.swap(current?.id, it.player, Keeping.REMEMBERED, asking.browser) }
        val trusted = email?.let(::emailOf)?.takeIf { verified }
        val holder = trusted?.let(stores.players::byEmail)?.takeIf { it.verified }
        val record = if (holder != null) {
            holder.copy(logins = holder.logins + login)
        } else {
            val base = current?.let { stores.players.of(it.player) }?.takeIf { it.guest } ?: PlayerRecord(newPlayer(), clock.instant())
            val free = trusted?.takeIf { stores.players.byEmail(it) == null }
            base.copy(logins = base.logins + login, email = base.email ?: free, verified = base.verified || free != null)
        }
        if (!stores.players.claim(record)) {
            // Taken in the moment since it was looked for: by the identity itself, which is then signed in to; or by the
            // email, which is left to its holder, and the identity kept alone.
            stores.players.byLogin(login)?.let { return signIns.swap(current?.id, it.player, Keeping.REMEMBERED, asking.browser) }
            stores.players.put(record.copy(email = holder?.email, verified = holder?.verified ?: false))
        }
        return signIns.swap(current?.id, record.player, Keeping.REMEMBERED, asking.browser)
    }

    /** Who [secret] is signed in as, used now, or null when it is no sign-in or one that has ended. */
    fun who(secret: String, cookie: Boolean = false): Who? {
        val signIn = signIns.find(secret) ?: return null
        val used = signIns.use(signIn, cookie)
        return Who(used.signIn, stores.players.of(signIn.player), used.cookieAgain)
    }

    /** [player]'s record: when they came, their settings, and their account if they have one. */
    fun recordOf(player: PlayerId): PlayerRecord? = stores.players.of(player)

    /** [player]'s settings, written whole; a value no setting takes is refused before anything is written. */
    fun settle(player: PlayerId, settings: Settings) {
        val record = stores.players.of(player) ?: PlayerRecord(player, clock.instant())
        stores.players.put(record.copy(settings = settings))
    }

    override fun signedIn(secret: String): SignedIn? = who(secret)?.let { SignedIn(it.signIn.player, it.signIn.id) }
}

/**
 * What a request says of where it came from: the browser as a person would name it, the address it came from, which
 * may ask so many times, and the page it was sent from, under which a mailed link opens.
 */
data class Asking(val browser: String, val from: String, val page: String)

/** A browser signed in, its player's record, and whether its cookie is to be given its lifetime again. */
data class Who(val signIn: SignIn, val record: PlayerRecord?, val cookieAgain: Boolean) {
    /** A player without an account: no email to sign in with. */
    val guest: Boolean get() = record?.guest ?: true
}

/** What asking for an account came to. */
sealed interface Making {
    /** Made, and the browser signed in to it with [begun]. */
    data class Made(val begun: Begun) : Making

    /** The email has an account already: it was mailed to say so, and nothing else changed. */
    data object Taken : Making

    /** Refused before anything was written, for [why]: `notAnEmail`, `tooMany`, or what is wrong with the password. */
    data class Refused(val why: String) : Making
}

/** What signing in came to. */
sealed interface Entering {
    data class In(val begun: Begun) : Entering

    /** The email and the password are not an account's: which of the two is wrong is not said. */
    data object NotThatPassword : Entering

    /** Too many tries for the email, or from the address, in a quarter of an hour. */
    data object TooMany : Entering
}
