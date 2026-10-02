package villages.gateway

import villages.application.CharacterRow
import villages.application.CharacterSpan
import villages.application.HouseRow
import villages.domain.WorldTime

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

    /** Whether the fog lets this house through. */
    fun letsSee(row: HouseRow): Boolean = !fogged || fog.letsThrough(row)

    /** Whether the fog lets this character, standing here, through on [day], the one it is looking at. */
    fun letsSee(row: CharacterRow, span: CharacterSpan, day: WorldTime): Boolean =
        !fogged || fog.letsThrough(row, span, day)

    /** Whether what the fog lets through is different from [was]: the switch, or the fog under it. */
    fun fogsOtherwiseThan(was: Looking): Boolean = fogged != was.fogged || (fogged && fog !== was.fog)
}
