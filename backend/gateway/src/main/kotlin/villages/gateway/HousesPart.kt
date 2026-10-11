package villages.gateway

import villages.application.HouseChange
import villages.application.HousesByCell
import villages.application.HousesByPlayer
import villages.domain.PlayerId
import villages.protocol.Cell
import villages.protocol.YourHouse

/**
 * A player's own house, which reaches them wherever they are looking, on hello and whenever it changes. Nobody else's
 * house is told to anyone: a house is not drawn on the map, its structures are, its seat among them, and a window
 * on a house asks after it by itself. See decision records 0075 and 0093.
 */
internal class HousesPart(
    private val core: Core,
    houses: HousesByCell,
    private val theirHouses: HousesByPlayer,
) : Part {
    private val changes: AutoCloseable = houses.watch { change -> told(change) }

    override fun greet(connection: Gateway.Connection, who: PlayerId) {
        connection.out.send(YourHouse(theirHouses.ofPlayer(who)?.toYours()))
    }

    private fun told(change: HouseChange) {
        val row = change.row
        // Your own house reaches you wherever you are looking.
        core.sessionOf(row.player)?.out?.send(YourHouse(row.toYours(Cell.of(row.seat.lat, row.seat.lon))))
    }

    override fun close() {
        changes.close()
    }
}
