package villages.protocol

/*
 * How the debug panel lists the players of the world, to switch this browser to one: a player is a token until
 * accounts exist (0008), so knowing one is enough to play as it. Instruments, refused while they are closed, and never
 * a player's: no player is told who the others are. See decision record 0101.
 */

/** Asks who plays in this world: answered by `playersListed`. */
class ListPlayers : ClientFrame {
    override fun equals(other: Any?): Boolean = other is ListPlayers

    override fun hashCode(): Int = javaClass.hashCode()

    override fun toString(): String = "ListPlayers"
}

/** One player of the world: the player's id, which is their token, and the name of the house they founded. */
data class PlayerView(val player: String, val house: String)

/** Every player with a house in this world, by the house's name. */
data class PlayersListed(val players: List<PlayerView>) : ServerFrame
