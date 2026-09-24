package villages.occurrent

import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldMatch
import tools.jackson.databind.JsonNode
import villages.domain.Banner
import villages.domain.CharacterAged
import villages.domain.CharacterAppeared
import villages.domain.CharacterDied
import villages.domain.CharacterId
import villages.domain.CharacterName
import villages.domain.CharacterLeftTheMap
import villages.domain.CharacterMoved
import villages.domain.CharacterPortraitChanged
import villages.domain.CharacterStatChanged
import villages.domain.Charge
import villages.domain.Choice
import villages.domain.ChoiceId
import villages.domain.Division
import villages.domain.Effect
import villages.domain.Event
import villages.domain.HouseFounded
import villages.domain.HouseGainedKeyFigure
import villages.domain.HouseLostKeyFigure
import villages.domain.Resource
import villages.domain.PledgeId
import villages.domain.HouseResourceSpent
import villages.domain.HouseResourceReleased
import villages.domain.HouseResourcePledged
import villages.domain.HouseResourceGranted
import villages.domain.PlayerGivenChoice
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.PlayerTookAction
import villages.domain.Location
import villages.domain.Option
import villages.domain.OptionId
import villages.domain.PlayerId
import villages.domain.Sex
import villages.domain.Significance
import villages.domain.Species
import villages.domain.Stat
import villages.domain.Tincture
import villages.domain.emptyStocks
import villages.domain.WorldTime
import java.io.File
import java.time.Instant
import java.util.UUID

/**
 * The stored form of an event is a contract with every future version of the code, so it is pinned to
 * a fixture: contracts/fixtures/events holds one CloudEvent per catalogued type, exactly as stored. A field
 * renamed, a value class boxed, an instant written as a number, would all show here first.
 *
 * Every catalogued type is checked, not only the first one: a type with no fixture is a shape nobody
 * agreed to, and the first case below is what makes forgetting one impossible.
 */
class EventFormatSpec : StringSpec({
    val converter = Events.converter()
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
        resources = emptyStocks(noon),
        worldTime = day,
        recordedAt = noon,
    )

    val choiceId = ChoiceId(UUID.fromString("aa000000-0000-4000-8000-00000000c401"))
    val northern = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000001"))
    val southern = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000002"))

    val whereToSettle = PlayerGivenChoice(
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

    val tookNorthern = PlayerTookAction(
        houseId = house,
        player = player,
        choiceId = choiceId,
        optionId = northern,
        worldTime = day,
        recordedAt = noon,
    )

    /** One event of every catalogued type, each pinned to the fixture of that name. */
    val pledgeId = PledgeId(UUID.fromString("bb000000-0000-4000-8000-00000000d101"))

    val givenGold = HouseResourceGranted(
        houseId = house,
        resource = Resource.WEALTH,
        amount = 120,
        worldTime = day,
        recordedAt = noon,
    )

    val spentGold = HouseResourceSpent(
        houseId = house,
        resource = Resource.WEALTH,
        amount = 50,
        worldTime = day,
        recordedAt = noon,
    )

    val pledgedReason = HouseResourcePledged(
        houseId = house,
        pledgeId = pledgeId,
        resource = Resource.REASON,
        amount = 35,
        until = WorldTime(455205),
        purpose = "the making of clearer glass",
        worldTime = day,
        recordedAt = noon,
    )

    val releasedReason = HouseResourceReleased(
        houseId = house,
        pledgeId = pledgeId,
        worldTime = WorldTime(455205),
        recordedAt = noon,
    )

    val agnes = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))
    val agnesAppeared = CharacterAppeared(
        characterId = agnes,
        name = CharacterName("Agnes", "Hollin"),
        sex = Sex.WOMAN,
        species = Species.PERSON,
        bornOn = WorldTime(642_700),
        stats = mapOf(Stat.PIETY to 13, Stat.REASON to 9, Stat.KINDNESS to 11, Stat.PHYSICAL to 7),
        portrait = "woman-03",
        worldTime = WorldTime(653_705),
        recordedAt = noon,
    )
    val agnesDied = CharacterDied(agnes, "a fever that did not break", WorldTime(653_705), noon)

    val tookAgnesIn = HouseGainedKeyFigure(house, agnes, day, noon)
    val lostAgnes = HouseLostKeyFigure(house, agnes, day, noon)
    val agnesAged = CharacterAged(agnes, 10, WorldTime(653_705), noon)
    val agnesRedrawn = CharacterPortraitChanged(agnes, "woman-04", WorldTime(653_705), noon)
    val agnesPiety = CharacterStatChanged(agnes, Stat.PIETY, 15, WorldTime(653_705), noon)
    val agnesMoved = CharacterMoved(agnes, Location(59.33, 18.07), Significance(10.0), WorldTime(653_705), noon)
    val agnesLeft = CharacterLeftTheMap(agnes, WorldTime(653_705), noon)

    val samples: Map<String, Event> = mapOf(
        "villages.character.aged.v1" to agnesAged,
        "villages.character.appeared.v1" to agnesAppeared,
        "villages.character.died.v1" to agnesDied,
        "villages.character.leftTheMap.v1" to agnesLeft,
        "villages.character.moved.v1" to agnesMoved,
        "villages.character.portraitChanged.v1" to agnesRedrawn,
        "villages.character.statChanged.v1" to agnesPiety,
        "villages.house.founded.v1" to ravenscar,
        "villages.house.gainedKeyFigure.v1" to tookAgnesIn,
        "villages.house.lostKeyFigure.v1" to lostAgnes,
        "villages.house.resourceGranted.v1" to givenGold,
        "villages.house.resourcePledged.v1" to pledgedReason,
        "villages.house.resourceReleased.v1" to releasedReason,
        "villages.house.resourceSpent.v1" to spentGold,
        "villages.player.givenChoice.v1" to whereToSettle,
        "villages.player.tookAction.v1" to tookNorthern,
    )

    fun fixture(type: String): JsonNode =
        Events.json.readTree(File("../../contracts/fixtures/events/$type.json"))

    "every catalogued type has a sample here, so none of them goes unpinned" {
        samples.keys shouldContainExactlyInAnyOrder EventTypes.rows.values.toSet()
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
                Events.json.readTree(stored.data!!.toBytes()) shouldBe pinned["data"]
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
            val bytes = Events.json.writeValueAsBytes(fixture(type)["data"])

            withClue(type) {
                Events.json.readValue(bytes, event.javaClass) shouldBe event
            }
        }
    }

    "a sealed field says which case it holds, so a reader never has to guess" {
        val written = Events.json.readTree(converter.toCloudEvent(whereToSettle).data!!.toBytes())

        written["choice"]["options"][0]["effect"][EFFECT_KIND].asString() shouldBe FOUND_AT
    }
})
