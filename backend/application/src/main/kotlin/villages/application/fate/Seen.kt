package villages.application.fate

import villages.application.Sight
import villages.domain.Location
import villages.domain.WorldTime
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/** The world's radius, in kilometres: the sphere a vision point's radius is measured over. */
private const val EARTH_KM = 6371.0

/** How far apart two places are on the ground, in kilometres, along the sphere. */
internal fun kmBetween(a: Location, b: Location): Double {
    val dLat = Math.toRadians(b.lat - a.lat)
    val dLon = Math.toRadians(b.lon - a.lon)
    val h = sin(dLat / 2) * sin(dLat / 2) +
        cos(Math.toRadians(a.lat)) * cos(Math.toRadians(b.lat)) * sin(dLon / 2) * sin(dLon / 2)
    return 2 * EARTH_KM * asin(sqrt(h.coerceIn(0.0, 1.0)))
}

/**
 * Whether a house has revealed a place: some vision point it has ever had covered it. The circles alone, without
 * the surface tension the gateway joins them by, so a place in a gap the tension fills is not counted - a roll may
 * read a little less than the fog draws, never more. See decision record 0061.
 */
internal fun Sight.reveals(place: Location): Boolean = points.any { kmBetween(it.place, place) <= it.radius }

/** Whether a house sees a place today: a vision point lasting today covers it. */
internal fun Sight.sees(place: Location, today: WorldTime): Boolean =
    visionOn(today).any { kmBetween(it.place, place) <= it.radius }
