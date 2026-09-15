package villages.occurrent

import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldMatch
import tools.jackson.databind.JsonNode
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Choice
import villages.domain.ChoiceId
import villages.domain.Division
import villages.domain.Effect
import villages.domain.HouseEvent
import villages.domain.HouseFounded
import villages.domain.HouseGivenChoice
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.HouseTookAction
import villages.domain.Location
import villages.domain.Option
import villages.domain.OptionId
import villages.domain.PlayerId
import villages.domain.Significance
import villages.domain.Tincture
import villages.domain.Treasury
import villages.domain.WorldTime
import java.io.File
import java.time.Instant
import java.util.UUID

/**
 * The stored form of a house event is a contract with every future version of the code, so it is pinned to
 * a fixture: contracts/fixtures/events holds one CloudEvent per catalogued type, exactly as stored. A field
 * renamed, a value class boxed, an instant written as a number, would all show here first.
 *
 * Every catalogued type is checked, not only the first one: a type with no fixture is a shape nobody
 * agreed to, and the first case below is what makes forgetting one impossible.
 */
class HouseEventFormatSpec : StringSpec({
    val converter = HouseEvents.converter()
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val house = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"))
    val player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val day = WorldTime(454901)

    val ravenscar = HouseFounded(
        houseId = house,
        player = player,
        name = HouseName("Ravenscar"),
        seat = Location(59.33, 18.07),
        significance = Significance(20.0),
        banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
        treasury = Treasury(0, 1.0, noon),
        worldTime = day,
        recordedAt = noon,
    )

    val choiceId = ChoiceId(UUID.fromString("aa000000-0000-4000-8000-00000000c401"))
    val northern = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000001"))
    val southern = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000002"))

    val whereToSettle = HouseGivenChoice(
        houseId = house,
        player = player,
        choice = Choice(
            id = choiceId,
            prompt = "Where shall the house raise its seat?",
            options = listOf(
                Option(
                    id = northern,
                    label = "Ravenscar, on the northern shore",
                    detail = "Cold water, long winters, and nobody near enough to argue with.",
                    effect = Effect.FoundAt(
                        seat = Location(59.33, 18.07),
                        name = HouseName("Ravenscar"),
                        banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
                    ),
                ),
                Option(
                    id = southern,
                    label = "Hollin, under the southern hills",
                    detail = "Warm ground and old roads, and neighbours on every one of them.",
                    effect = Effect.FoundAt(
                        seat = Location(47.5, 19.05),
                        name = HouseName("Hollin"),
                        banner = Banner(Tincture.OR, Division.PLAIN, null, Charge.TOWER, Tincture.GULES),
                    ),
                ),
            ),
        ),
        worldTime = day,
        recordedAt = noon,
    )

    val tookNorthern = HouseTookAction(
        houseId = house,
        player = player,
        choiceId = choiceId,
        optionId = northern,
        worldTime = day,
        recordedAt = noon,
    )

    /** One event of every catalogued type, each pinned to the fixture of that name. */
    val samples: Map<String, HouseEvent> = mapOf(
        "villages.house.founded.v1" to ravenscar,
        "villages.house.givenChoice.v1" to whereToSettle,
        "villages.house.tookAction.v1" to tookNorthern,
    )

    fun fixture(type: String): JsonNode =
        HouseEvents.json.readTree(File("../../contracts/fixtures/events/$type.json"))

    "every catalogued type has a sample here, so none of them goes unpinned" {
        samples.keys shouldContainExactlyInAnyOrder HouseEventTypes.rows.values.toSet()
    }

    "each event is stored exactly as its fixture says" {
        for ((type, event) in samples) {
            val pinned = fixture(type)
            val stored = converter.toCloudEvent(event)

            withClue(type) {
                stored.type shouldBe pinned["type"].asString()
                stored.source.toString() shouldBe pinned["source"].asString()
                stored.subject shouldBe pinned["subject"].asString()
                stored.time!!.toInstant() shouldBe Instant.parse(pinned["time"].asString())
                stored.id shouldMatch Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
                HouseEvents.json.readTree(stored.data!!.toBytes()) shouldBe pinned["data"]
            }
        }
    }

    "and comes back as the same event" {
        for ((type, event) in samples) {
            withClue(type) {
                converter.toDomainEvent(converter.toCloudEvent(event)) shouldBe event
            }
        }
    }

    "the fixtures themselves read back as the events, so the files are the contract and not the code" {
        for ((type, event) in samples) {
            val bytes = HouseEvents.json.writeValueAsBytes(fixture(type)["data"])

            withClue(type) {
                HouseEvents.json.readValue(bytes, event.javaClass) shouldBe event
            }
        }
    }

    "a sealed field says which case it holds, so a reader never has to guess" {
        val written = HouseEvents.json.readTree(converter.toCloudEvent(whereToSettle).data!!.toBytes())

        written["choice"]["options"][0]["effect"][EFFECT_KIND].asString() shouldBe FOUND_AT
    }
})
