package villages.protocol

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import tools.jackson.databind.json.JsonMapper
import java.io.File
import java.util.Base64

/**
 * The settlements layer's records are read by the gateway exactly as a stand's are: a middle and a reach, the
 * settlement's radius, which is all the fog's test asks of a record. Held to the records `world:settlements` writes
 * through the shared fixture. See decision record 0117.
 */
class SettlementRecordsSpec : StringSpec({

    // Gradle runs tests from the module directory, and the repository root is two above it.
    val fixture = JsonMapper().readTree(File("../../contracts/fixtures/settlement-records.json"))
    val records = Base64.getDecoder().decode(fixture["records"].asString())
    val tileX = fixture["tile"]["x"].asInt()
    val tileY = fixture["tile"]["y"].asInt()
    val settlements = (0 until fixture["settlements"].size()).map { fixture["settlements"][it] }

    "reads every settlement's middle and radius as a stand's middle and reach, from the shared records" {
        fixture["tileUnits"].asInt() shouldBe StandRecords.TILE_UNITS
        StandRecords.count(records) shouldBe settlements.size

        settlements.forEachIndexed { at, settlement ->
            StandRecords.x(records, at, tileX) shouldBe settlement["x"].asDouble()
            StandRecords.y(records, at, tileY) shouldBe settlement["y"].asDouble()
            StandRecords.reach(records, at) shouldBe settlement["reach"].asDouble()
        }
    }

    "is a layer the gateway sends" {
        ("settlements" in STAND_LAYERS) shouldBe true
    }
})
