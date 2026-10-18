package villages.gateway

import villages.application.Antarctica
import villages.application.StructureService
import villages.application.StructureChange
import villages.application.StructuresByCell
import villages.application.WorldClock
import villages.protocol.Cell
import villages.protocol.StructureArrived
import villages.protocol.StructureChanged
import villages.protocol.ON_THE_MAP_FROM

/**
 * Structures on the map: each one raised or changed, fanned out to every connection holding a cell it stands in and
 * seeing it now - or holding it, which a house that has just taken one does wherever it is.
 * What the fog has hidden is known as it was when it did, so what happens there since is not told: the cells are
 * answered again when the house sees the place. A change today is not part of an earlier day's map, so a connection
 * looking back at one is told nothing either. A cell's snapshot is the core's. See docs/plans/structures.md.
 */
internal class StructuresPart(
    private val core: Core,
    structures: StructuresByCell,
    private val world: WorldClock,
    private val open: Boolean,
    private val service: StructureService,
    private val antarctica: Antarctica,
) : Part {
    private val changes: AutoCloseable = structures.watch { change -> fanOut(change) }

    private fun fanOut(change: StructureChange) {
        val row = change.row
        val deepest = Cell.of(row.place.lat, row.place.lon)
        // Every zoom, not only the ones on the map: a connection with the eye open holds shallower
        // cells and is owed it there too. Eleven lookups, as for a house. See 0038.
        for (zoom in 0..Cell.MAX_ZOOM) {
            val holders = core.holders(deepest.at(zoom).quadkey) ?: continue
            for (connection in holders) {
                val looking = connection.looking
                if (!looking.isLive) continue
                val view = looking.sent(row, looking.day(world::today))?.takeIf { it.seenUntil == null } ?: continue
                if (zoom >= ON_THE_MAP_FROM || looking.everything) {
                    connection.enqueue(if (change.appeared) StructureArrived(view) else StructureChanged(view))
                }
            }
        }
    }

    override fun register(commands: Commands, frames: Frames) {
        structureLevers(commands, open, service, antarctica)
    }

    override fun close() {
        changes.close()
    }
}

/** The structures' place in the gateway: on the map, under the cells held, and Adam's levers for them. */
class StructuresMechanic(
    private val structures: StructuresByCell,
    private val service: StructureService,
    private val antarctica: Antarctica,
) : GatewayMechanic(greeting = 400) {
    override fun part(made: Made): Part = StructuresPart(made.core, structures, made.world, made.open, service, antarctica)
}
