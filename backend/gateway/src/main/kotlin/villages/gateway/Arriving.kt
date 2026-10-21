package villages.gateway

import villages.application.SignInId
import villages.application.SignedIn
import villages.domain.PlayerId
import villages.protocol.ClientFrame
import villages.protocol.ErrorFrame
import villages.protocol.FogOfWar
import villages.protocol.ListPlayers
import villages.protocol.ListSaves
import villages.protocol.LoadSave
import villages.protocol.ReviseCatalogue
import villages.protocol.SaveWorld
import villages.protocol.SeeAll
import villages.protocol.SignedOut
import villages.protocol.SimulateChallenge
import villages.protocol.WatchCatalogues
import villages.protocol.WatchEvents
import villages.protocol.WipeWorld
import villages.protocol.Hello
import java.util.UUID

/**
 * Whether a window's instruments are open: open on this server, [open], and, where they are open only to some, to
 * the sign-in it was opened with, [signedIn], as [only] says. A window opened with no sign-in is one of the pages
 * that only watch, and is open to them only where they are open to every window. See decision record 0076.
 */
internal fun instrumentsOf(open: Boolean, only: ((SignedIn?) -> Boolean)?, signedIn: SignedIn?): Boolean =
    open && (only == null || only(signedIn))

/** Whether [frame] is one of Adam's instruments' looks, which a window whose instruments are closed is refused. */
internal fun isAnInstrument(frame: ClientFrame): Boolean = when (frame) {
    is WatchEvents, is SeeAll, is FogOfWar, is WipeWorld, is WatchCatalogues, is ReviseCatalogue, is SaveWorld, is ListSaves,
    is LoadSave, is ListPlayers, is SimulateChallenge -> true
    else -> false
}

/** What a window whose instruments are closed is told of one of their looks. */
internal fun closedTo(frame: ClientFrame) =
    ErrorFrame("instrumentsClosed", "${frame::class.simpleName} is one of the instruments, and they are closed to this window")

/**
 * Stands down every window of [signIn], which has ended - signed out, run out, or ended from another browser - with
 * `signedOut`, as a takeover stands one down: a window belongs to a live sign-in. See decision record 0111.
 */
fun Gateway.signInEnded(signIn: SignInId) {
    live.filter { it.isOf(signIn) }.forEach { it.finish(SignedOut("this browser's sign-in has ended")) }
}

/** Who a hello arrives as, or why it arrives as nobody. */
internal sealed interface Arriving {
    data class As(val player: PlayerId) : Arriving

    data class Refused(val why: ErrorFrame) : Arriving
}

/**
 * Who [frame] arrives as: the player its connection's sign-in plays as, which the socket's handshake read from the
 * browser's cookie, or, while Adam's instruments are open, whoever it says to play as - the seeder's twenty houses,
 * the swarm's thousands. A browser holds no secret it could send, so nothing else in a hello names a player. See
 * docs/plans/accounts.md and decision record 0111.
 */
internal fun arrivingAs(frame: Hello, signedIn: SignedIn?, instrumentsOpen: Boolean): Arriving {
    val playAs = frame.playAs
    return when {
        playAs != null && !instrumentsOpen ->
            Arriving.Refused(ErrorFrame("instrumentsClosed", "playing as somebody else is an instrument, and they are closed"))
        playAs != null ->
            runCatching { UUID.fromString(playAs) }.fold(
                onSuccess = { Arriving.As(PlayerId(it)) },
                onFailure = { Arriving.Refused(ErrorFrame("playAs", "not a player: $playAs")) },
            )
        signedIn != null -> Arriving.As(signedIn.player)
        else -> Arriving.Refused(ErrorFrame("notSignedIn", "this browser is signed in to nobody: the page asks /auth/me first"))
    }
}
