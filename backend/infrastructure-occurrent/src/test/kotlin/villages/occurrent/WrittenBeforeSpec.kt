package villages.occurrent

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import tools.jackson.databind.node.ObjectNode
import villages.domain.Character
import villages.domain.CharacterAppeared
import villages.domain.CharacterDecider
import villages.domain.House
import villages.domain.HouseDecider
import villages.domain.HouseFounded
import villages.domain.PlayerGivenChoice
import villages.domain.Resource
import villages.domain.Stat
import villages.domain.Stock
import villages.domain.UNRECORDED_STAT
import java.io.File

/**
 * A stored event is read as it was written, and never refused for what the code has learned since: a founding
 * written before a resource existed, or an appearance before a stat did, reads back from the store and folds
 * whole. Read off the stored fixtures with a field taken out, which is what the store will hold the day a sixth
 * resource or a fifth stat arrives. See decision record 0074.
 */
class WrittenBeforeSpec : StringSpec({

    // Tests run from the module directory, and the repository root is two above it.
    fun storedData(type: String): ObjectNode =
        Events.json.readTree(File("../../contracts/fixtures/events/$type.json"))["data"] as ObjectNode

    "a founding written before a resource existed reads back, and the house holds none of it" {
        val data = storedData("villages.house.founded.v1")
        (data["resources"] as ObjectNode).remove("PIETY")
        val founding = Events.json.readValue(Events.json.writeValueAsBytes(data), HouseFounded::class.java)

        founding.resources.keys shouldBe Resource.entries.toSet() - Resource.PIETY
        val house = HouseDecider.fold(listOf(founding)).shouldBeInstanceOf<House.Founded>()
        house.stockOf(Resource.PIETY) shouldBe Stock(0, 0.0, founding.recordedAt)
    }

    "an option written before options had a rarity or omens reads back with neither" {
        val data = storedData("villages.player.givenChoice.v1")
        for (option in data["choice"]["options"]) {
            (option as ObjectNode).remove(listOf("rarity", "omens"))
        }
        val given = Events.json.readValue(Events.json.writeValueAsBytes(data), PlayerGivenChoice::class.java)

        given.choice.options.map { it.rarity }.toSet() shouldBe setOf(null)
        given.choice.options.map { it.omens }.toSet() shouldBe setOf(emptyList())
    }

    "an appearance written before a stat existed reads back, with the middle of the scale of it" {
        val data = storedData("villages.character.appeared.v1")
        (data["stats"] as ObjectNode).remove("KINDNESS")
        val appeared = Events.json.readValue(Events.json.writeValueAsBytes(data), CharacterAppeared::class.java)

        val character = CharacterDecider.fold(listOf(appeared)).shouldBeInstanceOf<Character.Appeared>()
        character.stats[Stat.KINDNESS] shouldBe UNRECORDED_STAT
        character.stats[Stat.PIETY] shouldBe 13
    }
})
