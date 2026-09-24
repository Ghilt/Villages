package villages.domain

/**
 * A place in the world, in the world's own longitude and latitude, which are not Earth's. A house's seat
 * is one of these. Latitude is held to the poles and longitude to the half turn either way.
 */
data class Location(val lat: Double, val lon: Double) {
    init {
        if (lat.isNaN() || lat < -90.0 || lat > 90.0) throw DomainError.InvalidLocation("latitude $lat")
        if (lon.isNaN() || lon < -180.0 || lon > 180.0) throw DomainError.InvalidLocation("longitude $lon")
    }
}
