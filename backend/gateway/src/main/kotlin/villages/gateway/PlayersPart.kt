package villages.gateway

import villages.application.EveryHouse
import villages.protocol.ErrorFrame
import villages.protocol.ListPlayers
import villages.protocol.PlayerView
import villages.protocol.PlayersListed

/**
 * The players of the world, as the debug panel lists them to switch this browser to one: every player with a house, by
 * the house's name and whether it is a house bot (0108), answered to the window that asked. Instruments, refused `instrumentsClosed` where they are closed,
 * because a player's token is all it takes to play as them. See decision record 0101.
 */
internal class PlayersPart(private val open: Boolean, private val houses: EveryHouse) : Part {
    override fun register(commands: Commands, frames: Frames) {
        frames.on<ListPlayers> { connection, _ ->
            connection.out.send(
                if (open) {
                    PlayersListed(
                        houses.everyHouse().map { PlayerView(it.player.value.toString(), it.name.value, houses.isBot(it.player)) },
                    )
                } else {
                    ErrorFrame("instrumentsClosed", "listPlayers is one of the instruments, and they are closed here")
                },
            )
        }
    }
}
