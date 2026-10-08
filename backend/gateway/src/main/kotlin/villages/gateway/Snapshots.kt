package villages.gateway

import villages.application.CharactersByCell
import villages.application.HousesByCell
import villages.application.PlacedCharacter
import villages.application.WorldClock
import villages.protocol.Snapshot

/**
 * What [cell] holds on the day [looking] is looking at, and of that what its fog lets through: the core's answer to a
 * cell taken, and to every held cell again when the way of looking changes. Everything on the map that rides a cell
 * is read here, a line for each kind of thing.
 */
internal fun snapshotOf(
    cell: String,
    looking: Looking,
    world: WorldClock,
    houses: HousesByCell,
    onTheMap: CharactersByCell,
): Snapshot {
    val day = looking.day(world::today)
    val (contents, sent) = looking.housesIn(houses, cell, day, MOST_IN_A_CELL)
    val standing = onTheMap.inCell(cell, day, MOST_IN_A_CELL, looking.everything) { placed: PlacedCharacter ->
        looking.letsSee(placed.row, placed.span, day)
    }
    return Snapshot(
        cell = cell,
        houses = sent,
        asOfVersion = contents.asOf,
        omitted = contents.omitted,
        characters = standing.characters.map { it.row.toMapView(it.span) },
        omittedCharacters = standing.omitted,
    )
}
