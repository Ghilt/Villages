package villages.gateway

import villages.application.HouseById
import villages.application.StructureRow
import villages.application.StructuresByCell
import villages.domain.HouseId
import villages.domain.PlayerId
import villages.protocol.YourHoldings

/**
 * A house's holdings, which reach its player wherever they are looking, as its key figures do: every structure it
 * holds now, its seat first and the rest in the order it came to hold them, each in today's face, because what is
 * one's own the fog does not hide. Told when the player arrives, and again whenever a structure changes that the
 * house holds or has just stopped holding. See docs/plans/structures.md.
 */
internal class HoldingsPart(
    private val core: Core,
    private val structures: StructuresByCell,
    private val houses: HouseById,
) : Part {
    private val changes: AutoCloseable = structures.watch { change -> told(change.row) }

    override fun greet(connection: Gateway.Connection, who: PlayerId) {
        connection.out.send(holdingsOf(HouseId.of(who)))
    }

    /** The house that holds it now and the one that held it a face before, if another: both are told. */
    private fun told(row: StructureRow) {
        val now = row.faces.last().holder?.house
        val was = row.faces.getOrNull(row.faces.size - 2)?.holder?.house
        for (house in setOfNotNull(now, was)) {
            val player = houses.ofHouse(house)?.player ?: continue
            core.sessionOf(player)?.out?.send(holdingsOf(house))
        }
    }

    private fun holdingsOf(house: HouseId): YourHoldings = YourHoldings(
        structures.heldBy(house)
            .sortedWith(compareBy({ if (it.faces.last().seatOf?.house == house) 0 else 1 }, { heldSince(it, house) }))
            .map { it.toView(it.faces.last(), seenUntil = null) },
    )

    /** The stamp of the face the house's holding of it began with: the order it came to hold them in. */
    private fun heldSince(row: StructureRow, house: HouseId): Long {
        val run = row.faces.takeLastWhile { it.holder?.house == house }
        return run.firstOrNull()?.stamp ?: Long.MAX_VALUE
    }

    override fun close() {
        changes.close()
    }
}
