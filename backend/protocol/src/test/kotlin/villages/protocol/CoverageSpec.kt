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

    "reaches at no distance exactly what it covers, on every shared vector" {
        for (vector in vectors) {
            val circles = vector["circles"].let { list -> (0 until list.size()).map { list[it] } }.map {
                Coverage.Circle(it["lat"].asDouble(), it["lon"].asDouble(), it["kilometres"].asDouble())
            }
            val place = vector["place"]
            val lat = place["lat"].asDouble()
            val lon = place["lon"].asDouble()
            withClue(vector["name"].asString()) {
                Coverage(circles, vector["tension"].asDouble())
                    .reaches(mercatorX(lon), mercatorY(lat), 0.0) shouldBe vector["covered"].asBoolean()
            }
        }
    }

    "reaches a place outside a lone circle once the distance is as far as the gap, and not before" {
        // A lone circle stays exactly its circle however tense, so what it reaches is exactly its circle grown.
        val seat = Coverage(listOf(Coverage.Circle(50.0, 15.0, 34.0)), 40.0)
        val x = mercatorX(15.0) + across(50.0, 44.0)
        val y = mercatorY(50.0)

        seat.covers(latitudeAt(y), 15.0 + across(50.0, 44.0) * 360.0) shouldBe false
        seat.reaches(x, y, across(50.0, 9.9)) shouldBe false
        seat.reaches(x, y, across(50.0, 10.1)) shouldBe true
    }

    "reaches a place near a bridge between two circles before it reaches one as near a lone circle" {
        // Two seat-sized circles a hundred kilometres apart are seen across, and a place just off the bridge
        // between them is near covered ground, where the same place beside one circle alone would not be.
        val a = Coverage.Circle(59.33, 18.07, 34.0)
        val b = Coverage.Circle(59.33, 19.83, 34.0)
        val between = mercatorX(18.95)
        val offTheBridge = mercatorY(59.33) + across(59.33, 30.0)

        Coverage(listOf(a, b), 40.0).reaches(between, offTheBridge, across(59.33, 15.0)) shouldBe true
        Coverage(listOf(a), 40.0).reaches(between, offTheBridge, across(59.33, 15.0)) shouldBe false
    }

    "with no circles reaches nothing, however far it looks" {
        Coverage(emptyList(), 40.0).reaches(0.5, 0.3, 0.1) shouldBe false
    }
})
