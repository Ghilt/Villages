package villages.app

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import villages.application.Stands
import villages.domain.Location
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.roundToInt
import kotlin.math.tan

/** JUnit rather than Kotest here, as in the rest of this module. */
class RoadsNearTest {
    private val place = Location(54.25, 18.94)
    private val x = (place.lon + 180) / 360 * WORLD
    private val y = (0.5 - ln(tan(PI / 4 + Math.toRadians(place.lat) / 2)) / (2 * PI)) * WORLD
    private val tileX = floor(x / 256).toInt()
    private val tileY = floor(y / 256).toInt()

    /** One piece of road, a record as `world:roads` writes it: running east from just west of [place]. */
    private val road: ByteArray = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).apply {
        putShort(((x + 1 - tileX * 256) * 8).roundToInt().toShort())
        putShort(((y - tileY * 256) * 8).roundToInt().toShort())
        put(20)
        put(24)
        put(0)
        put(1)
    }.array()

    private val stands = Stands { master, layer, tx, ty ->
        if (master == "terrain" && layer == "roads" && tx == tileX && ty == tileY) road else null
    }

    @Test
    fun `a place on a road is near it, and one ten kilometres off is not`() {
        val roads = RoadsNear(stands, "terrain")
        assertTrue(roads.within(place, 1.0))
        assertFalse(roads.within(Location(place.lat + 0.09, place.lon), 4.0))
        assertTrue(roads.within(Location(place.lat + 0.09, place.lon), 12.0))
    }

    @Test
    fun `a master with no roads laid has none near anything`() {
        assertFalse(RoadsNear(stands, "nowhere").within(place, 50.0))
    }

    private companion object {
        const val WORLD = 32_768.0
    }
}
