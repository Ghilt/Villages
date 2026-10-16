package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import villages.application.CatalogueRefused
import villages.application.DialogueTemplate.ShowsWhat
import villages.application.DialogueTemplate.Who
import villages.domain.Effect
import villages.domain.Impact
import villages.domain.LineId
import villages.domain.Resource
import villages.domain.RevealImpact
import villages.domain.Then
import java.io.File

/** A dialogue file as the server reads it, held to the fixture the world package's reader is held to. */
class DialogueFileTest {
    private val fixture = File("../../contracts/fixtures/dialogue.json").readText()

    @Test
    fun `the fixture reads as it says, every kind of field once`() {
        val dialogue = DialogueFile.parse(fixture, "fixture")

        assertEquals("A word at the gate", dialogue.title)
        assertEquals("harbour", dialogue.scene)
        assertEquals(listOf(Who.KeyFigure, Who.Named("The abbot", "man-01")), dialogue.speakers.map { it.who })
        val (asks, give, keep, thanks) = dialogue.lines
        assertEquals(Then.DialogueChoice(listOf(LineId("give"), LineId("keep"))), asks.then)
        assertEquals(ShowsWhat.SEAT, asks.shows)
        assertEquals(listOf(Effect.Spend(Resource.PIETY, 10)), give.effects)
        assertEquals(RevealImpact.Shown(listOf(Impact(Resource.PIETY, -10), Impact(Resource.INFLUENCE, 3))), give.revealImpact)
        assertEquals(RevealImpact.Hidden, keep.revealImpact)
        assertEquals(Then.End, keep.then)
        assertEquals(listOf(Effect.Grant(Resource.INFLUENCE, 3)), thanks.effects)
        assertEquals(ShowsWhat.KEY_FIGURE, thanks.shows)
    }

    @Test
    fun `every real dialogue reads, holds together, and is in the one form`() {
        val files = File("../../world/catalogues/dialogues").listFiles { file -> file.extension == "json" }!!
        for (file in files) {
            val text = file.readText()
            DialogueFile.parse(text, file.nameWithoutExtension).check(file.nameWithoutExtension)
            assertEquals(text, CatalogueText.format(text), file.name)
        }
    }

    @Test
    fun `one that does not hold together is refused by the shelf, naming the file and why`() {
        val loop = fixture.replace("\"then\": \"thanks\"", "\"then\": \"asks\"")

        val refused = assertThrows<CatalogueRefused> { DialogueFile.parse(loop, "fixture").check("fixture") }
        assertEquals(
            "world/catalogues/dialogues/fixture.json: not a dialogue: line asks can be reached from itself, so a path through the dialogue would not end",
            refused.message,
        )
    }
}
