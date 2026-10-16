package villages.application.fate

import villages.application.TEST_BALANCE
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import villages.domain.Location

/** Land masses read off the ground, and which of them are islands. See decision record 0096. */
class GroundIslandsSpec : StringSpec({
    // 360 by 180 cells, a degree each, all sea but for a continent from 0 to 99 east on every row from 30 north to 30
    // south, a lake in the middle of it, an island of four cells at 150 east on the equator, and a strip of land at the
    // antimeridian that joins round it.
    val cells = ByteArray(360 * 180 * 2)
    fun paint(x: Int, y: Int, terrain: Int) {
        cells[(y * 360 + x) * 2] = terrain.toByte()
    }
    for (y in 0 until 180) for (x in 0 until 360) paint(x, y, 1)
    for (y in 60 until 120) for (x in 180 until 280) paint(x, y, 0)
    for (y in 88..91) for (x in 228..231) paint(x, y, 2)
    for (y in 89..90) for (x in 330..331) paint(x, y, 0)
    for (y in 10..11) { paint(0, y, 3); paint(359, y, 0) }
    val ground = GroundMap(360, 180, mapOf(0 to "grassland", 1 to "ocean", 2 to "lake", 3 to "river"), cells)
    val islands = GroundIslands({ if (it == "terrain") ground else null }, "terrain") { TEST_BALANCE }

    "every cell of one land mass is the same land, a lake's cells none, and a strip across the antimeridian one land" {
        val continent = ground.landJoinedTo(ground.indexOf(Location(0.5, 10.5)))
        continent shouldNotBe null
        ground.landJoinedTo(ground.indexOf(Location(29.5, 99.5))) shouldBe continent
        ground.landJoinedTo(ground.indexOf(Location(0.5, 50.5))) shouldBe null
        ground.landJoinedTo(ground.indexOf(Location(-50.0, 50.0))) shouldBe null
        ground.landJoinedTo(ground.indexOf(Location(79.5, -179.5))) shouldBe ground.landJoinedTo(ground.indexOf(Location(79.5, 179.5)))
    }

    "a land mass is measured in square kilometres, narrower cells nearer the poles" {
        val island = ground.landJoinedTo(ground.indexOf(Location(0.5, 150.5)))!!
        ground.areaOfLand(island) shouldBe (4 * 111.3 * 111.1 * kotlin.math.cos(Math.toRadians(0.5)) plusOrMinus 30.0)
    }

    "land smaller than the smallest continent is an island, and the sea, a lake and an unknown world are not" {
        islands.onAnIsland(Location(0.5, 150.5)).shouldBeTrue()
        islands.onAnIsland(Location(0.5, 10.5)).shouldBeFalse()
        islands.onAnIsland(Location(0.5, 50.5)).shouldBeFalse()
        islands.onAnIsland(Location(-50.0, 50.0)).shouldBeFalse()
        GroundIslands({ null }, "terrain") { TEST_BALANCE }.onAnIsland(Location(0.5, 150.5)).shouldBeFalse()
    }
})
