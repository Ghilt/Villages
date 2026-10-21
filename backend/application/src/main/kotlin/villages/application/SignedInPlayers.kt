package villages.application

import villages.domain.PlayerId
import java.util.UUID

/**
 * Who a browser's sign-in plays as: what the socket's handshake asks of the cookie it carries. The accounts are kept
 * behind it, beside the world and never in it, so the game knows a player only by the id this hands over. See
 * docs/plans/accounts.md.
 */
fun interface SignedInPlayers {
    /** Who [secret] is signed in as, or null when it is no sign-in, or one that has ended. */
    fun signedIn(secret: String): SignedIn?
}

/** A browser signed in: the player it plays as, and which of that player's sign-ins it is. */
data class SignedIn(val player: PlayerId, val signIn: SignInId)

/** One sign-in, by an id that is not its secret: what a list of them names, and what ending one says ended. */
@JvmInline
value class SignInId(val value: UUID)
