package villages.protocol

import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import tools.jackson.databind.json.JsonMapper
import java.io.File

class ReachSpec : StringSpec({

    // Gradle runs tests from the module directory, and the repository root is two above it.
    val fixture = JsonMapper().readTree(File("../../contracts/fixtures/reach.json"))
    val vectors = (0 until fixture["vectors"].size()).map { fixture["vectors"][it] }

    "agrees with the shared vectors the browser is also held to" {
        vectors.size shouldBe 11

        for (vector in vectors) {
            val centre = vector["centre"]
            val place = vector["place"]
            val reach = Reach(centre["lat"].asDouble(), centre["lon"].asDouble(), vector["kilometres"].asDouble())
            withClue(vector["name"].asString()) {
                reach.covers(place["lat"].asDouble(), place["lon"].asDouble()) shouldBe vector["within"].asBoolean()
            }
        }
    }
})
