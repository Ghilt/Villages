package villages.gateway

import villages.application.CellContents
import villages.application.CharacterRow
import villages.application.CharacterSpan
import villages.application.HouseRow
import villages.application.HousesByCell
import villages.application.StructureRow
import villages.application.StructuresByCell
import villages.domain.HouseId
import villages.domain.WorldTime
import villages.protocol.coarsestZoom
import villages.protocol.HouseView
import villages.protocol.StructureView

/**
 * How a connection is looking at the world: on which day, with the eye open or not, and through what fog. One
 * value, replaced whole, so that whatever reads it - a fan-out on a read model's thread, a snapshot on the
 * socket's - reads one way of looking and never half of a change to it. See decision records 0038 and 0061.
 */
internal data class Looking(
    /** The world-day it is looking at, or null for live: the scrubber's position. */
    val at: WorldTime? = null,
    /**
     * Whether the eye is open: significance set aside, so every house in a held cell reaches it however far back
     * the camera is. See decision record 0038.
     */
    val everything: Boolean = false,
    /**
     * Whether the fog of war holds back what the house cannot see: on, unless Adam's switch has lifted it for this
     * window. See decision record 0061.
     */
    val fogged: Boolean = true,
    /** What the fog lets through, from the house's vision points: next to nothing until hello says whose. */
    val fog: Fog = Fog.NOBODY,
) {
    /** Whether it is the world as it is today, rather than an earlier day. */
    val isLive: Boolean get() = at == null

    /** The day it is looking at: today, unless the scrubber has gone back. */
    fun day(today: () -> WorldTime): WorldTime = at ?: today()

    /** Whether a house is on this day. Live sees everything; the past sees what existed then. */
    fun sees(row: HouseRow): Boolean = at?.let { row.existsAt(it) } ?: true

    /**
     * A house as this connection is sent it on [day], the one it is looking at, or null where its fog holds it back:
     * on ground it no longer sees, as it was when the fog hid it, and dated so, so that the page shows what it is told
     * and works out nothing. See [Fog.sent] and decision records 0061 and 0089.
     */
    fun sent(row: HouseRow, day: WorldTime, view: HouseView = row.toView()): HouseView? =
        if (!fogged) view else fog.sent(row, day, view)

    /** What a cell holds of houses on [day], and of that what this connection is sent: each worked out once. */
    fun housesIn(houses: HousesByCell, cell: String, day: WorldTime, most: Int): Pair<CellContents, List<HouseView>> {
        val sent = HashMap<HouseId, HouseView>()
        val contents = houses.inCell(cell, day, most, everything) { row ->
            sent(row, day)?.also { sent[row.id] = it } != null
        }
        return contents to contents.houses.map { sent.getValue(it.id) }
    }

    /**
     * A structure as this connection is sent it on [day]: the face of that day where it sees, or where the fog is
     * lifted; the face it last saw on ground revealed, dated so; or nothing. See [Fog.faceOf].
     */
    fun sent(row: StructureRow, day: WorldTime): StructureView? =
        if (!fogged) {
            row.faceOn(day)?.let { row.toView(it, null) }
        } else {
            fog.faceOf(row, day)?.let { (face, hid) -> row.toView(face, hid) }
        }

    /**
     * What a cell holds of structures on [day] that this connection is sent and that are worth drawing at its zoom by
     * the face it is sent - every one with the eye open - most significant first, at most [most], and how many more.
     */
    fun structuresIn(structures: StructuresByCell, cell: String, day: WorldTime, most: Int): Pair<List<StructureView>, Int> {
        val sent = structures.inCell(cell, everything)
            .mapNotNull { sent(it, day) }
            .filter { everything || coarsestZoom(it.significance) <= cell.length }
            .sortedWith(compareByDescending<StructureView> { it.significance }.thenBy { it.id })
        return sent.take(most) to (sent.size - most).coerceAtLeast(0)
    }

    /** Whether the fog lets this character, standing here, through on [day], the one it is looking at. */
    fun letsSee(row: CharacterRow, span: CharacterSpan, day: WorldTime): Boolean =
        !fogged || fog.letsThrough(row, span, day)

    /** Whether what the fog lets through is different from [was]: the switch, or the fog under it. */
    fun fogsOtherwiseThan(was: Looking): Boolean = fogged != was.fogged || (fogged && fog !== was.fog)
}
