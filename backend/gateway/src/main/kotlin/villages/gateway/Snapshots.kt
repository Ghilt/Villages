package villages.gateway

import villages.application.CharactersByCell
import villages.application.PlacedCharacter
import villages.application.StructuresByCell
import villages.application.WorldClock
import villages.protocol.Snapshot

/**
 * What [cell] holds on the day [looking] is looking at, and of that what its fog lets through: the core's answer to a
 * cell taken, and to every held cell again when the way of looking changes. Everything on the map that rides a cell
 * is read here, a line for each kind of thing: the people and the structures, and no houses, which are not drawn.
 */
internal fun snapshotOf(
    cell: String,
    looking: Looking,
    world: WorldClock,
    onTheMap: CharactersByCell,
    structures: StructuresByCell,
): Snapshot {
    val day = looking.day(world::today)
    val standing = onTheMap.inCell(cell, day, MOST_IN_A_CELL, looking.everything) { placed: PlacedCharacter ->
        looking.letsSee(placed.row, placed.span, day)
    }
    // Read before the rows, so that every face stamped no later is in them: a copy the page holds stamped later came
    // from a change this snapshot may not have seen, and is kept.
    val structuresAsOf = structures.asOf()
    val (raised, omittedStructures) = looking.structuresIn(structures, cell, day, MOST_IN_A_CELL)
    return Snapshot(
        cell = cell,
        characters = standing.characters.map { it.row.toMapView(it.span) },
        omittedCharacters = standing.omitted,
        structures = raised,
        omittedStructures = omittedStructures,
        structuresAsOf = structuresAsOf,
    )
}
