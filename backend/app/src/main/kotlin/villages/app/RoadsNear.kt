package villages.app

import villages.application.Stands
import villages.domain.Location
import villages.protocol.STAND_TILES
import villages.protocol.StandRecords
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.ln
import kotlin.math.tan

/**
 * Whether a place stands near a road of a master's world: the pieces of the `roads` layer of its stands about it, each a
 * straight line from its middle half its length either way, as `world:roads` wrote them. What a house bot's seat keeps
 * clear of at the opening, so a fresh world stands no castle across a road. See decision records 0108 and 0115.
 */
internal class RoadsNear(private val stands: Stands, private val master: String) {
    /** Whether [place] stands nearer than [km] to any piece of road. */
    fun within(place: Location, km: Double): Boolean {
        val x = (place.lon + HALF_TURN) / FULL_TURN * WORLD
        val y = (0.5 - ln(tan(PI / 4 + Math.toRadians(place.lat) / 2)) / (2 * PI)) * WORLD
        val units = km / (KM_A_UNIT * cos(Math.toRadians(place.lat)).coerceAtLeast(LEAST_COS))
        val tileX = floor(x / TILE).toInt()
        val tileY = floor(y / TILE).toInt()
        for (ty in tileY - 1..tileY + 1) {
            for (tx in tileX - 1..tileX + 1) {
                val wrapped = Math.floorMod(tx, STAND_TILES)
                val records = stands.of(master, LAYER, wrapped, ty) ?: continue
                // A tile across the world's edge is read as standing beside this one.
                val shift = (tx - wrapped) * TILE
                for (at in 0 until StandRecords.count(records)) {
                    val mx = StandRecords.x(records, at, wrapped) + shift
                    val my = StandRecords.y(records, at, ty)
                    val hx = StandRecords.halfAcross(records, at)
                    val hy = StandRecords.halfDown(records, at)
                    if (awayFrom(x, y, mx - hx, my - hy, mx + hx, my + hy) < units) return true
                }
            }
        }
        return false
    }

    /** How far a point is from the straight line between two others. */
    private fun awayFrom(x: Double, y: Double, ax: Double, ay: Double, bx: Double, by: Double): Double {
        val dx = bx - ax
        val dy = by - ay
        val long = dx * dx + dy * dy
        val t = if (long == 0.0) 0.0 else (((x - ax) * dx + (y - ay) * dy) / long).coerceIn(0.0, 1.0)
        return hypot(x - (ax + t * dx), y - (ay + t * dy))
    }

    private companion object {
        const val LAYER = "roads"
        const val TILE = StandRecords.TILE_UNITS
        const val WORLD = StandRecords.WORLD_UNITS.toDouble()
        const val FULL_TURN = 360.0
        const val HALF_TURN = 180.0

        /** Kilometres a world unit spans at the equator: the Earth's girth over the world's width. */
        const val KM_A_UNIT = 40_075.016_686 / WORLD

        /** Never read a world unit as narrower than at this cosine of its latitude. */
        const val LEAST_COS = 0.05
    }
}
