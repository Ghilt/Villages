package villages.protocol

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.ln
import kotlin.math.tan

/**
 * How far a vision point reaches on the map, and whether a place lies within it: a circle on the Mercator
 * plane around the point's place, as many kilometres across as it sees at its own latitude.
 *
 * This lives beside the cells for the reason they do: both ends must compute it identically. The page draws the
 * fog clear inside it and the gateway sends what stands inside it, and a disagreement would be a castle drawn on
 * clear ground that never arrives, or one sent to stand under the haze. `contracts/fixtures/reach.json` holds
 * the vectors both are held to. It is the map's circle and not the globe's, which a reach as wide as a country
 * would show; decision record 0061 makes the size a distance on the ground and leaves its shape to the map.
 */
class Reach(lat: Double, lon: Double, kilometres: Double) {
    private val x = mercatorX(lon)
    private val y = mercatorY(lat)

    /** How far it reaches, as a share of the side of the Mercator square. */
    private val across = kilometres / (EQUATOR_KM * cos(lat * PI / 180.0))

    fun covers(lat: Double, lon: Double): Boolean = hypot(mercatorX(lon) - x, mercatorY(lat) - y) <= across

    companion object {
        /** The circumference Web Mercator is drawn from, in kilometres: the sphere the map and the tiles share. */
        const val EQUATOR_KM = 40_075.016686

        private fun mercatorX(lon: Double): Double = (lon + 180.0) / 360.0

        private fun mercatorY(lat: Double): Double {
            val radians = lat.coerceIn(-Cell.MERCATOR_EDGE, Cell.MERCATOR_EDGE) * PI / 180.0
            return 0.5 - ln(tan(PI / 4.0 + radians / 2.0)) / (2.0 * PI)
        }
    }
}
