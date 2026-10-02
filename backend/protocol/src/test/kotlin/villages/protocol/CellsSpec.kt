package villages.protocol

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldHaveLength
import io.kotest.property.Arb
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.numericDouble
import io.kotest.property.checkAll
import tools.jackson.databind.json.JsonMapper
import java.io.File
import kotlin.math.PI
import kotlin.math.atan
import kotlin.math.sinh

class CellsSpec : StringSpec({

    // Gradle runs tests from the module directory, and the repository root is two above it.
    val fixture = JsonMapper().readTree(File("../../contracts/fixtures/cells.json"))
    // Read by index rather than iterated: Jackson 3's node offers more than one iterator and Kotlin
    // cannot choose between them.
    fun rows(name: String) = (0 until fixture[name].size()).map { fixture[name][it] }
    val zooms = rows("zooms").map { it.asInt() }
    val vectors = rows("vectors")

    "agrees at every zoom with the shared vectors the browser is also held to" {
        vectors.size shouldBe 8

        for (vector in vectors) {
            for (zoom in zooms) {
                val expected = vector["quadkeys"][zoom.toString()].asString()
                Cell.of(vector["lat"].asDouble(), vector["lon"].asDouble(), zoom).quadkey shouldBe expected
            }
        }
    }

    "gives a place the same cell whether asked directly or by rolling up from deeper" {
        for (vector in vectors) {
            val deepest = Cell.of(vector["lat"].asDouble(), vector["lon"].asDouble())
            for (zoom in zooms) {
                deepest.at(zoom) shouldBe Cell.of(vector["lat"].asDouble(), vector["lon"].asDouble(), zoom)
            }
        }
    }

    "is digits of 0 to 3, as deep as it was asked for, wherever in the world you stand" {
        // Numeric, so the arbitrary never hands over NaN, which is not a place.
        checkAll(
            Arb.numericDouble(-90.0, 90.0),
            Arb.numericDouble(-180.0, 180.0),
            Arb.int(0, Cell.MAX_ZOOM),
        ) { lat, lon, zoom ->
            val cell = Cell.of(lat, lon, zoom)
            cell.quadkey shouldHaveLength zoom
            cell.zoom shouldBe zoom
            cell.quadkey.all { it in '0'..'3' } shouldBe true
        }
    }

    "puts every cell inside its own ancestors and inside the whole world" {
        checkAll(Arb.numericDouble(-90.0, 90.0), Arb.numericDouble(-180.0, 180.0)) { lat, lon ->
            val cell = Cell.of(lat, lon)
            for (zoom in 0..Cell.MAX_ZOOM) {
                cell.isInside(cell.at(zoom)) shouldBe true
            }
            cell.isInside(Cell("")) shouldBe true
        }
    }

    "knows which column and row it is, counted from the north-west corner at its own zoom" {
        Cell("").column shouldBe 0
        Cell("").row shouldBe 0
        // The equator on the prime meridian is the corner four tiles share, and falls in the south-east one.
        Cell("30").column shouldBe 2
        Cell("30").row shouldBe 2
        Cell("3000000000").column shouldBe 512
        Cell("3000000000").row shouldBe 512
        Cell("0000000").column shouldBe 0
        Cell("3333333").row shouldBe 127
        Cell("1111111").column shouldBe 127
        Cell("1111111").row shouldBe 0
    }

    "is the tile a place in the middle of that tile falls in, at every zoom" {
        checkAll(Arb.int(0, Cell.MAX_ZOOM), Arb.int(0, (1 shl Cell.MAX_ZOOM) - 1), Arb.int(0, (1 shl Cell.MAX_ZOOM) - 1)) {
                zoom, across, down ->
            val tiles = 1 shl zoom
            val column = across % tiles
            val row = down % tiles
            val lon = (column + 0.5) / tiles * 360.0 - 180.0
            val lat = atan(sinh(PI * (1.0 - 2.0 * (row + 0.5) / tiles))) * 180.0 / PI

            val cell = Cell.of(lat, lon, zoom)
            cell.column shouldBe column
            cell.row shouldBe row
        }
    }

    "keeps two places in different halves of the world out of each other's cells" {
        val west = Cell.of(0.0, -90.0, 2)
        val east = Cell.of(0.0, 90.0, 2)

        west.isInside(east) shouldBe false
        east.isInside(west) shouldBe false
    }

    "refuses to be anything but a quadkey no deeper than the grid" {
        shouldThrow<IllegalArgumentException> { Cell("1234") }
        shouldThrow<IllegalArgumentException> { Cell("12a") }
        shouldThrow<IllegalArgumentException> { Cell("00000000000") }
        shouldThrow<IllegalArgumentException> { Cell.of(0.0, 0.0, Cell.MAX_ZOOM + 1) }
        shouldThrow<IllegalArgumentException> { Cell("1200").at(5) }
    }

    "draws the legendary from the whole world and the ordinary only from close up" {
        coarsestZoom(100.0) shouldBe 0
        coarsestZoom(0.0) shouldBe Cell.MAX_ZOOM
    }

    "never draws a lesser thing from further out than a greater one" {
        checkAll(Arb.numericDouble(0.0, 100.0), Arb.numericDouble(0.0, 100.0)) { lesser, greater ->
            if (lesser <= greater) {
                (coarsestZoom(lesser) >= coarsestZoom(greater)) shouldBe true
            }
        }
    }

    "answers with a zoom the grid has, whatever significance it is handed" {
        checkAll(Arb.numericDouble(-1000.0, 1000.0)) { significance ->
            (coarsestZoom(significance) in 0..Cell.MAX_ZOOM) shouldBe true
        }
    }
})
