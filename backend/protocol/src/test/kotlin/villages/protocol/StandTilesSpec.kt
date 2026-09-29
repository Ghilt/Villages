package villages.protocol

import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import tools.jackson.databind.json.JsonMapper
import java.io.File

class StandTilesSpec : StringSpec({

    // Gradle runs tests from the module directory, and the repository root is two above it.
    val fixture = JsonMapper().readTree(File("../../contracts/fixtures/stand-tiles.json"))
    val vectors = (0 until fixture["vectors"].size()).map { fixture["vectors"][it] }

    "the fixture's grid is this one" {
        fixture["tiles"].asInt() shouldBe STAND_TILES
        fixture["margin"].asDouble() shouldBe STAND_TILE_MARGIN
        fixture["fromZoom"].asInt() shouldBe STANDS_FROM_ZOOM
    }

    "agrees with the shared vectors the browser is also held to" {
        vectors.size shouldBe 10

        for (vector in vectors) {
            val tiles = vector["tiles"]
            val wanted = (0 until tiles.size()).map { tiles[it][1].asInt() * STAND_TILES + tiles[it][0].asInt() }
            withClue(vector["name"].asString()) {
                standTilesUnder(vector["cell"].asString()) shouldContainExactlyInAnyOrder wanted
            }
        }
    }
})
