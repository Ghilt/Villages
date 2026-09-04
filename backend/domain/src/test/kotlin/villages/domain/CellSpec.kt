package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldHaveLength
import io.kotest.property.Arb
import io.kotest.property.arbitrary.numericDouble
import io.kotest.property.checkAll
import java.io.File

class CellSpec : StringSpec({

    "agrees with the shared vectors that the browser is also held to" {
        // contracts/fixtures/cells.json was produced by a second implementation. Gradle runs tests from the
        // module directory, and the repository root is two above it.
        val fixture = File("../../contracts/fixtures/cells.json").readText()
        val rows = Regex(""""lat":\s*(-?[\d.]+),\s*"lon":\s*(-?[\d.]+),\s*"quadkey":\s*"(\d{8})"""").findAll(fixture).toList()
        rows.size shouldBe 8

        for (row in rows) {
            val (lat, lon, quadkey) = row.destructured
            Cell.of(Location(lat.toDouble(), lon.toDouble())).quadkey shouldBe quadkey
        }
    }

    "is eight digits of 0 to 3 wherever in the world you stand" {
        // Numeric, so the arbitrary never hands over NaN, which is not a place and which Location rightly refuses.
        checkAll(Arb.numericDouble(-90.0, 90.0), Arb.numericDouble(-180.0, 180.0)) { lat, lon ->
            val cell = Cell.of(Location(lat, lon))
            cell.quadkey shouldHaveLength Cell.ZOOM
            cell.quadkey.all { it in '0'..'3' } shouldBe true
        }
    }

    "refuses to be anything else" {
        shouldThrow<IllegalArgumentException> { Cell("1234567") }
        shouldThrow<IllegalArgumentException> { Cell("1234567a") }
    }
})
