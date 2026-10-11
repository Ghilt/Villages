package villages.gateway

import villages.application.StructureFace
import villages.application.StructureRow
import villages.domain.WorldTime
import villages.protocol.Cell
import villages.protocol.HolderView
import villages.protocol.Point
import villages.protocol.SlotView
import villages.protocol.StructureView

/**
 * A structure as the map shows it, in the face it is sent in: the one of the day asked where the house sees it, or the
 * one it last saw, with the day the fog hid it, and its slots when the house sees into them now. See
 * docs/plans/structures.md and decision record 0089.
 */
internal fun StructureRow.toView(face: StructureFace, seenUntil: WorldTime?, slots: List<SlotView>? = null): StructureView = StructureView(
    id = id.value.toString(),
    structureType = face.type.name,
    name = name,
    place = Point(place.lat, place.lon),
    cell = Cell.of(place.lat, place.lon).quadkey,
    level = face.level,
    holder = face.holder?.let { HolderView(it.house.value.toString(), it.name.value, it.banner.toWire()) },
    significance = face.significance.value,
    since = faces.first().since.day,
    // With its slots, it is as new as the later of its face and them, so a page holding it replaces it either way.
    stamp = if (slots == null) face.stamp else maxOf(face.stamp, slotsStamp),
    seenUntil = seenUntil?.day,
    seatOf = face.seatOf?.let { HolderView(it.house.value.toString(), it.name.value, it.banner.toWire()) },
    ruin = if (face.ruin) true else null,
    slots = slots,
)
