package villages.gateway

import villages.application.CharacterRow
import villages.application.CharacterSpan
import villages.application.HouseRow
import villages.application.VisionPoint
import villages.domain.HouseId
import villages.domain.PlayerId
import villages.domain.WorldTime
import villages.protocol.Reach

/**
 * What the fog of war lets one player be sent, worked out from their house's vision points: the table in
 * decision record 0061, asked of everything before it goes to them.
 *
 * - **Vision**, the points lasting on the day looked at: everything.
 * - **Revealed**, every point there has been: what stands still, which is the buildings, and not what moves,
 *   which is people.
 * - **Unknown**: only what is of significance 80 or more.
 *
 * A player's own house and own key figures always reach them. Every one of them gives vision where it stands,
 * so this changes nothing about what is sent; said outright, it means a key figure's move is never told as a
 * departure while the sight that follows them is still catching up.
 *
 * Whether a place is within a point is `Reach`, the arithmetic the page draws the fog with, so what is sent
 * and what is drawn clear cannot disagree.
 */
internal class Fog(private val player: PlayerId?, points: List<VisionPoint>) {
    private val house: HouseId? = player?.let { HouseId.of(it) }
    private val reaches = points.map { it to Reach(it.place.lat, it.place.lon, it.radius) }

    fun letsThrough(row: HouseRow): Boolean =
        row.player == player ||
            row.significance.value >= SEEN_THROUGH_THE_FOG ||
            reaches.any { (_, reach) -> reach.covers(row.seat.lat, row.seat.lon) }

    fun letsThrough(row: CharacterRow, span: CharacterSpan, on: WorldTime): Boolean =
        row.keyFigureOf.any { it.house == house } ||
            span.significance.value >= SEEN_THROUGH_THE_FOG ||
            reaches.any { (point, reach) -> point.covers(on) && reach.covers(span.place.lat, span.place.lon) }

    companion object {
        /** How significant a thing has to be to be seen from anywhere: 0061's really big event, drawn from zoom 2. */
        const val SEEN_THROUGH_THE_FOG = 80.0

        /** The fog of a connection that has not said who it is: it sees nothing, so only the really big. */
        val NOBODY = Fog(null, emptyList())
    }
}
