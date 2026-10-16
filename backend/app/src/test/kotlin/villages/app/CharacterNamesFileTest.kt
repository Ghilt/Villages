package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.io.File

/** The character names as the server reads them, held to the fixture the world package's reader is held to. */
class CharacterNamesFileTest {
    @Test
    fun `the fixture reads as it says`() {
        val names = CharacterNamesFile.parse(File("../../contracts/fixtures/character-names.json").readText())

        assertEquals(listOf("Agnes", "Ursula"), names.women)
        assertEquals(listOf("Anton", "Wilhelm"), names.men)
        assertEquals(listOf("Achterberg", "Ystad"), names.family)
    }

    @Test
    fun `the real names read, every one a name a character can have, and are in the one form`() {
        val text = File("../../world/catalogues/character-names.json").readText()

        CharacterNamesFile.parse(text).check()
        assertEquals(text, CatalogueText.format(text))
    }
}
