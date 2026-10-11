package villages.gateway

import villages.application.StructureFace
import villages.application.StructureRow
import villages.domain.WorldTime
import villages.protocol.Cell
import villages.protocol.HolderView
import villages.protocol.Point
import villages.protocol.StructureView

/**
 * A structure as the map shows it, in the face it is sent in: the one of the day asked where the house sees it, or the
 * one it last saw, with the day the fog hid it. See docs/plans/structures.md and decision record 0089.
 */
internal fun StructureRow.toView(face: StructureFace, seenUntil: WorldTime?): StructureView = StructureView(
    id = id.value.toString(),
    structureType = face.type.name,
    name = name,
    place = Point(place.lat, place.lon),
    cell = Cell.of(place.lat, place.lon).quadkey,
    level = face.level,
    holder = face.holder?.let { HolderView(it.house.value.toString(), it.name.value, it.banner.toWire()) },
    significance = face.significance.value,
    since = faces.first().since.day,
    stamp = face.stamp,
    seenUntil = seenUntil?.day,
    seatOf = face.seatOf?.let { HolderView(it.house.value.toString(), it.name.value, it.banner.toWire()) },
    ruin = if (face.ruin) true else null,
)
