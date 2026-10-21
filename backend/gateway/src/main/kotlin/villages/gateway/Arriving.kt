package villages.gateway

import villages.application.SignedIn
import villages.domain.PlayerId
import villages.protocol.ErrorFrame
import villages.protocol.Hello
import java.util.UUID

/** Who a hello arrives as, or why it arrives as nobody. */
internal sealed interface Arriving {
    data class As(val player: PlayerId) : Arriving

    data class Refused(val why: ErrorFrame) : Arriving
}

/**
 * Who [frame] arrives as: the player its connection's sign-in plays as, which the socket's handshake read from the
 * browser's cookie, or, while Adam's instruments are open, whoever it says to play as - the seeder's twenty houses,
 * the swarm's thousands. A browser holds no secret it could send, so nothing else in a hello names a player. See
 * docs/plans/accounts.md and decision record 0109.
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
