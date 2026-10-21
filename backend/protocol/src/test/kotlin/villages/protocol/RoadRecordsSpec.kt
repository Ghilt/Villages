package villages.protocol

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import tools.jackson.databind.json.JsonMapper
import java.io.File
import java.util.Base64

/**
 * The roads layer's records are read by the gateway exactly as a stand's are: a middle and a reach, which is all the
 * fog's test asks of a record. Held to the records `world:roads` writes through the shared fixture. See decision
 * record 0115.
 */
class RoadRecordsSpec : StringSpec({

    // Gradle runs tests from the module directory, and the repository root is two above it.
    val fixture = JsonMapper().readTree(File("../../contracts/fixtures/roads.json"))
    val records = Base64.getDecoder().decode(fixture["records"].asString())
    val tileX = fixture["tile"]["x"].asInt()
    val tileY = fixture["tile"]["y"].asInt()
    val pieces = (0 until fixture["pieces"].size()).map { fixture["pieces"][it] }

    "reads every piece's middle and reach as a stand's, from the shared records" {
        fixture["tileUnits"].asInt() shouldBe StandRecords.TILE_UNITS
        StandRecords.count(records) shouldBe pieces.size

        pieces.forEachIndexed { at, piece ->
            StandRecords.x(records, at, tileX) shouldBe piece["middle"]["x"].asDouble()
            StandRecords.y(records, at, tileY) shouldBe piece["middle"]["y"].asDouble()
            StandRecords.reach(records, at) shouldBe piece["reach"].asDouble()
        }
    }

    "reads both ends of every piece, as far each way from its middle" {
        pieces.forEachIndexed { at, piece ->
            val mx = StandRecords.x(records, at, tileX)
            val my = StandRecords.y(records, at, tileY)
            mx - StandRecords.halfAcross(records, at) shouldBe piece["ax"].asDouble()
            my - StandRecords.halfDown(records, at) shouldBe piece["ay"].asDouble()
            mx + StandRecords.halfAcross(records, at) shouldBe piece["bx"].asDouble()
            my + StandRecords.halfDown(records, at) shouldBe piece["by"].asDouble()
        }
    }

    "is a layer the gateway sends" {
        ("roads" in STAND_LAYERS) shouldBe true
    }
})
