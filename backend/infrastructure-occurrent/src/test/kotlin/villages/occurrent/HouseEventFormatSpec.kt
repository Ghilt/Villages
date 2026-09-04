package villages.occurrent

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldMatch
import tools.jackson.databind.JsonNode
import villages.domain.Banner
import villages.domain.Cell
import villages.domain.Charge
import villages.domain.Division
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Tincture
import villages.domain.Treasury
import java.io.File
import java.time.Instant
import java.util.UUID

/**
 * The stored form of a house event is a contract with every future version of the code, so it is pinned to
 * a fixture: contracts/fixtures/events holds one CloudEvent per catalogued type, exactly as stored. A field
 * renamed, a value class boxed, an instant written as a number, would all show here first.
 */
class HouseEventFormatSpec : StringSpec({
    val converter = HouseEvents.converter()
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val ravenscar = HouseFounded(
        houseId = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a")),
        player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d")),
        name = HouseName("Ravenscar"),
        seat = Location(59.33, 18.07),
        cell = Cell("12003122"),
        banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
        treasury = Treasury(0, 1.0, noon),
        at = noon,
    )
    val pinned: JsonNode = HouseEvents.json.readTree(File("../../contracts/fixtures/events/villages.house.founded.v1.json"))

    "a HouseFounded is stored exactly as the fixture says" {
        val stored = converter.toCloudEvent(ravenscar)

        stored.type shouldBe pinned["type"].asString()
        stored.source.toString() shouldBe pinned["source"].asString()
        stored.subject shouldBe pinned["subject"].asString()
        stored.time!!.toInstant() shouldBe Instant.parse(pinned["time"].asString())
        stored.id shouldMatch Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
        HouseEvents.json.readTree(stored.data!!.toBytes()) shouldBe pinned["data"]
    }

    "and comes back as the same event" {
        converter.toDomainEvent(converter.toCloudEvent(ravenscar)) shouldBe ravenscar
    }

    "the fixture itself reads back as the event, so the file is the contract and not the code" {
        val bytes = HouseEvents.json.writeValueAsBytes(pinned["data"])
        val event = HouseEvents.json.readValue(bytes, HouseFounded::class.java)

        event shouldBe ravenscar
    }
})
