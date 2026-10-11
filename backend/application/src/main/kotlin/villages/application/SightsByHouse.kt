package villages.application

import villages.domain.CharacterId
import villages.domain.HouseId
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.StructureId
import villages.domain.VisionId
import villages.domain.WorldTime

/**
 * What gives a house a **vision point**: the thing it sees from. Anything can, in time; two things do today.
 */
sealed interface VisionSource {
    /** The house's own seat, from the day it was founded, for as long as the house stands. */
    data object Seat : VisionSource

    /** One of its key figures, for as long as they stand in one place and are the house's. */
    data class KeyFigure(val character: CharacterId) : VisionSource

    /** A vision given outright, from the day it was given until it is taken away. */
    data class Given(val vision: VisionId) : VisionSource
}

/**
 * Somewhere a house sees from, for a stretch of world-time: a place, how far it sees around it, and the span
 * it gives vision over. Adam's shape, so that anything can give vision and give it for a while - a seat for
 * as long as the house stands, a key figure for as long as they stand in one place, and later a far coast for
 * a couple of months. See decision record 0061.
 *
 * The radius is a distance on the ground, in kilometres, rather than in map units: how far a house sees is a
 * fact about the world, and how big that looks on the map is the map's to work out, the argument decision
 * 0026 makes about cells. Mercator keeps a circle round, so the drawn circle is still a circle.
 */
data class VisionPoint(
    val source: VisionSource,
    val place: Location,
    /** How far it sees around its place, in kilometres. */
    val radius: Double,
    val since: WorldTime,
    /** The day it stopped giving vision, or null while it still does. */
    val until: WorldTime?,
    /** The structure a vision given is seen from, or null: what the log names it by. See 0092. */
    val from: StructureId? = null,
) {
    /** Whether it gives vision on a day: `since <= day < until`, the rule every span in the world keeps. */
    fun covers(at: WorldTime): Boolean = at >= since && (until == null || at < until)
}

/**
 * What one house can see: every vision point it has had, oldest first. Its **vision** is the points lasting
 * on the day asked about; what it has **revealed** is everything any of them has ever covered, the ones that
 * ended included; everything else is **unknown**. Nothing here is stored: it is worked out from where the
 * house's seat and its people have stood. See decision record 0061.
 */
data class Sight(val house: HouseId, val points: List<VisionPoint>) {
    /** The points giving vision on a day. */
    fun visionOn(at: WorldTime): List<VisionPoint> = points.filter { it.covers(at) }
}

/** A house's sight as it now stands, for the player whose house it is. */
data class SightChange(val house: HouseId, val player: PlayerId, val sight: Sight)

/**
 * What every house can see. What the fog of war is drawn from on the page, and what the gateway will ask
 * before it sends a player anything; it reaches the player wherever they are looking, like their house.
 */
interface SightsByHouse {
    /** Every vision point the house has had, oldest first. None for a house that does not exist. */
    fun of(house: HouseId): Sight

    /** Every change to a house's vision points from now on, told to its player's listener, until closed. */
    fun watch(listener: (SightChange) -> Unit): AutoCloseable
}
