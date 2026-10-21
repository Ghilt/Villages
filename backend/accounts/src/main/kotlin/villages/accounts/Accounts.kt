package villages.accounts

import villages.application.SignInId
import villages.application.SignedIn
import villages.application.SignedInPlayers
import villages.domain.PlayerId
import java.time.Clock
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
) : SignedInPlayers {
    val signIns = SignIns(stores.signIns, clock, ended)

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

    /** Who [secret] is signed in as, used now, or null when it is no sign-in or one that has ended. */
    fun who(secret: String, cookie: Boolean = false): Who? {
        val signIn = signIns.find(secret) ?: return null
        val used = signIns.use(signIn, cookie)
        return Who(used.signIn, stores.players.of(signIn.player), used.cookieAgain)
    }

    /** [player]'s settings, written whole; a value no setting takes is refused before anything is written. */
    fun settle(player: PlayerId, settings: Settings) {
        val record = stores.players.of(player) ?: PlayerRecord(player, clock.instant())
        stores.players.put(record.copy(settings = settings))
    }

    override fun signedIn(secret: String): SignedIn? = who(secret)?.let { SignedIn(it.signIn.player, it.signIn.id) }
}

/** A browser signed in, its player's record, and whether its cookie is to be given its lifetime again. */
data class Who(val signIn: SignIn, val record: PlayerRecord?, val cookieAgain: Boolean) {
    /** A player without an account: every player, until accounts can be made. */
    val guest: Boolean get() = true
}
