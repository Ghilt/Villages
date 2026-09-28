package villages.protocol

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import tools.jackson.databind.json.JsonMapper
import java.io.File
import java.util.Base64

class StandRecordsSpec : StringSpec({

    // Gradle runs tests from the module directory, and the repository root is two above it.
    val fixture = JsonMapper().readTree(File("../../contracts/fixtures/stands.json"))
    val records = Base64.getDecoder().decode(fixture["records"].asString())
    val tileX = fixture["tile"]["x"].asInt()
    val tileY = fixture["tile"]["y"].asInt()
    val stands = (0 until fixture["stands"].size()).map { fixture["stands"][it] }

    "reads every stand's middle and reach as the page's decoder does, from the shared records" {
        fixture["tileUnits"].asInt() shouldBe StandRecords.TILE_UNITS
        StandRecords.count(records) shouldBe stands.size

        stands.forEachIndexed { at, stand ->
            StandRecords.x(records, at, tileX) shouldBe stand["x"].asDouble()
            StandRecords.y(records, at, tileY) shouldBe stand["y"].asDouble()
            StandRecords.reach(records, at) shouldBe stand["reach"].asDouble()
        }
    }

    "keeps the records it is told to, byte for byte and in their order" {
        val kept = StandRecords.only(records) { it != 1 }

        StandRecords.count(kept) shouldBe 2
        kept.copyOfRange(0, 8).toList() shouldBe records.copyOfRange(0, 8).toList()
        kept.copyOfRange(8, 16).toList() shouldBe records.copyOfRange(16, 24).toList()
        StandRecords.only(records) { false }.size shouldBe 0
    }

    "counts only whole records, so a stray byte on the end is not a stand" {
        StandRecords.count(records.copyOf(records.size + 3)) shouldBe stands.size
    }
})
