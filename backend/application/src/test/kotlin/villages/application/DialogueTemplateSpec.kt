package villages.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.CharacterId
import villages.domain.CharacterName
import villages.domain.DialogueId
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.LineId
import villages.domain.Location
import villages.domain.Shows
import java.util.UUID

/** A dialogue file's roles, filled for the house it is offered to: its key figure, its seat, the house itself. */
class DialogueTemplateSpec : StringSpec({
    val house = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"))
    val agnes = DialogueTemplate.Figure(CharacterId(UUID.randomUUID()), CharacterName("Agnes", "Holm"), "woman-01")
    val id = DialogueId(UUID.randomUUID())

    "the key figure speaks as who they are, is named in the words, and is what a line shows" {
        val letter = TEST_LETTER.offered(id, DialogueTemplate.Filling(house, Location(54.36, 18.64), agnes))

        letter.speakers.first().let { listOf(it.name, it.portrait, it.character) } shouldBe listOf("Agnes Holm", "woman-01", agnes.id)
        letter.line(LineId("arrives"))!!.words shouldBe
            "Agnes, a rider has come in from the coast with a letter under the harbour-master's seal."
        letter.line(LineId("arrives"))!!.shows shouldBe Shows.Place(Location(54.36, 18.64))
        letter.line(LineId("paid"))!!.shows shouldBe Shows.House(house)
        letter.line(LineId("answer"))!!.shows shouldBe Shows.Character(agnes.id)
    }

    "a house with no seat yet is offered it with the seat's line showing nothing" {
        TEST_LETTER.offered(id, DialogueTemplate.Filling(house, null, agnes)).line(LineId("arrives"))!!.shows shouldBe null
    }

    "a dialogue that needs a key figure is refused a house that has none, and one that does not needs none" {
        TEST_LETTER.needsKeyFigure shouldBe true
        shouldThrow<HouseError.NoSuchKeyFigure> { TEST_LETTER.offered(id, DialogueTemplate.Filling(house, null, null)) }

        val among = TEST_LETTER.copy(
            speakers = TEST_LETTER.speakers.map { it.copy(who = DialogueTemplate.Who.Named("A steward", null)) },
            lines = TEST_LETTER.lines.map { it.copy(says = it.says.replace("{given}", "Steward"), shows = null) },
        )
        among.needsKeyFigure shouldBe false
        among.offered(id, DialogueTemplate.Filling(house, null, null)).speakers.first().character shouldBe null
    }
})
