package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import villages.application.CatalogueRefused
import villages.domain.challenge.ChallengeBehaviours
import java.io.File

/**
 * The challenge's code and its catalogue held to each other, both ways: every effect, buff and debuff in the real
 * catalogue has a behaviour with the numbers it reads, and every behaviour has its entry there. The shelf refuses a catalogue the code
 * cannot fight with, so that half is held as the server runs; the other half, code nobody's catalogue names, is held here.
 */
class ChallengeBehavioursTest {
    private val real = File("../../world/catalogues/challenges.json").readText()

    @Test
    fun `the real catalogue asks nothing of the code that the code lacks`() {
        assertEquals(emptyList<String>(), ChallengeBehaviours.unmatched(ChallengesFile.parse(real)))
    }

    @Test
    fun `every behaviour in the code has its entry in the real catalogue`() {
        val catalogue = ChallengesFile.parse(real)

        assertEquals(emptySet<String>(), ChallengeBehaviours.effects.keys - catalogue.effects.map { it.id }.toSet())
        assertEquals(emptySet<String>(), ChallengeBehaviours.summons.keys - catalogue.summons.keys)
        assertEquals(emptySet<String>(), ChallengeBehaviours.lasting.keys - (catalogue.buffs.keys + catalogue.debuffs.keys))
    }

    @Test
    fun `the shelf refuses an effect the code has no behaviour for, and one without a number its behaviour reads`() {
        val shelf = mapOf(
            "structures" to File("../../world/catalogues/structures.json").readText(),
            "balance" to File("../../world/catalogues/balance.json").readText(),
            "fate" to File("../../world/catalogues/fate.json").readText(),
            "character-names" to File("../../world/catalogues/character-names.json").readText(),
        )
        val unknown = real.replace("\"noQuarter\": {", "\"noMercy\": {")
        val numberless = real.replace("\"numbers\": { \"chance\": 25 }", "\"numbers\": { \"odds\": 25 }")

        assertEquals(
            "world/catalogues/challenges.json: violence.noMercy has no behaviour in the code",
            assertThrows<CatalogueRefused> { ShelfReader.read(shelf + ("challenges" to unknown)) }.message,
        )
        assertEquals(
            "world/catalogues/challenges.json: violence.noQuarter gives no number 'chance', which its behaviour reads",
            assertThrows<CatalogueRefused> { ShelfReader.read(shelf + ("challenges" to numberless)) }.message,
        )
    }
}
