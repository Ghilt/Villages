package villages.gateway

import villages.application.HouseChange
import villages.application.HousesByCell
import villages.application.HousesByPlayer
import villages.application.WorldClock
import villages.domain.PlayerId
import villages.protocol.Cell
import villages.protocol.Delta
import villages.protocol.HouseAppeared
import villages.protocol.HouseChanged
import villages.protocol.HouseView
import villages.protocol.YourHouse
import villages.protocol.coarsestZoom

/**
 * The houses on the map: a player's own, which reaches them wherever they are looking, and every house's
 * changes, fanned out to whoever holds a cell it is in and sees it now: what the fog has hidden is known as it was
 * when it did, and its changes since are not told. A cell's snapshot is the core's, because one frame answers for everything in a cell. See
 * decision records 0026, 0075 and 0089.
 */
internal class HousesPart(
    private val core: Core,
    houses: HousesByCell,
    private val theirHouses: HousesByPlayer,
    private val world: WorldClock,
) : Part {
    private val changes: AutoCloseable = houses.watch { change -> fanOut(change) }

    override fun greet(connection: Gateway.Connection, who: PlayerId) {
        connection.out.send(YourHouse(theirHouses.ofPlayer(who)?.toYours()))
    }

    private fun fanOut(change: HouseChange) {
        val row = change.row
        val deepest = Cell.of(row.seat.lat, row.seat.lon)
        val view = row.toView(deepest)

        // Your own house reaches you wherever you are looking, not only when you hold its cell.
        core.sessionOf(row.player)?.out?.send(YourHouse(row.toYours(deepest)))

        // Whether it is new is the read model's answer, not the stream version's: a house founded from a
        // choice arrives at version three, behind the choice it was given and the action that took it.
        val delta: (HouseView) -> Delta = { if (change.appeared) HouseAppeared(it) else HouseChanged(it) }
        val coarsest = coarsestZoom(row.significance.value)
        // Every zoom, not only the ones this house is significant enough for: a connection with the eye
        // open holds shallower cells and is owed the change in them too. Still eleven lookups. See 0038.
        for (zoom in 0..Cell.MAX_ZOOM) {
            val holders = core.holders(deepest.at(zoom).quadkey) ?: continue
            for (connection in holders) {
                val looking = connection.looking
                if ((zoom >= coarsest || looking.everything) && looking.sees(row)) {
                    // What the fog has hidden is known as it was when it did, so nothing that happens to it since
                    // reaches the player, its founding included; their cells are answered again when they see it.
                    looking.sent(row, looking.day(world::today), view)?.takeIf { it.seenUntil == null }
                        ?.let { connection.enqueue(delta(it)) }
                }
            }
        }
    }

    override fun close() {
        changes.close()
    }
}
