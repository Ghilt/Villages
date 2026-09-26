package villages.protocol

import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import tools.jackson.databind.json.JsonMapper
import java.io.File

class CoverageSpec : StringSpec({

    // Gradle runs tests from the module directory, and the repository root is two above it.
    val fixture = JsonMapper().readTree(File("../../contracts/fixtures/coverage.json"))
    val vectors = (0 until fixture["vectors"].size()).map { fixture["vectors"][it] }

    "agrees with the shared vectors the browser is also held to" {
        vectors.size shouldBe 17

        for (vector in vectors) {
            val circles = vector["circles"].let { list -> (0 until list.size()).map { list[it] } }.map {
                Coverage.Circle(it["lat"].asDouble(), it["lon"].asDouble(), it["kilometres"].asDouble())
            }
            val place = vector["place"]
            withClue(vector["name"].asString()) {
                Coverage(circles, vector["tension"].asDouble())
                    .covers(place["lat"].asDouble(), place["lon"].asDouble()) shouldBe vector["covered"].asBoolean()
            }
        }
    }

    "with no circles covers nothing" {
        Coverage(emptyList(), 40.0).covers(50.0, 15.0) shouldBe false
    }
})
