package villages.application.settlements

import villages.application.fate.kmBetween
import villages.domain.Location

/**
 * Places kept in squares of a degree, so whether a place stands within some kilometres of any of them asks only the
 * ones near it: what a settlement asks of the bots' seats at the opening, and a bot's seat of the settlements' sites.
 * Nothing is near anything for nought kilometres. See decision records 0108 and 0114.
 */
class PlacesNear(places: List<Location>, private val km: Double) {
    private val squares = places.groupBy { keyOf(it.lat, it.lon) }

    /** Whether [place] stands nearer than the kilometres to any of the places. */
    fun within(place: Location): Boolean {
        if (km <= 0.0) return false
        val reach = 1 + (km / KM_A_DEGREE).toInt()
        for (dLat in -reach..reach) {
            for (dLon in -reach..reach) {
                val near = squares[keyOf(place.lat + dLat, place.lon + dLon)] ?: continue
                if (near.any { kmBetween(it, place) < km }) return true
            }
        }
        return false
    }

    private fun keyOf(lat: Double, lon: Double): Long =
        Math.floor(lat).toLong() * 1_000 + Math.floorMod(Math.floor(lon).toLong(), 360L)

    private companion object {
        /** Kilometres a degree of latitude spans, near enough for which squares to ask. */
        const val KM_A_DEGREE = 111.0
    }
}
