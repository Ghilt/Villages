package villages.accounts

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
) : SignedInPlayers {
    val signIns = SignIns(stores.signIns, clock)

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

    /** Who [secret] is signed in as, used now, or null when it is no sign-in or one that has ended. */
    fun who(secret: String, cookie: Boolean = false): Who? {
        val signIn = signIns.find(secret) ?: return null
        val used = signIns.use(signIn, cookie)
        return Who(used.signIn, stores.players.of(signIn.player), used.cookieAgain)
    }

    override fun signedIn(secret: String): SignedIn? = who(secret)?.let { SignedIn(it.signIn.player, it.signIn.id) }
}

/** A browser signed in, its player's record, and whether its cookie is to be given its lifetime again. */
data class Who(val signIn: SignIn, val record: PlayerRecord?, val cookieAgain: Boolean) {
    /** A player without an account: every player, until accounts can be made. */
    val guest: Boolean get() = true
}
