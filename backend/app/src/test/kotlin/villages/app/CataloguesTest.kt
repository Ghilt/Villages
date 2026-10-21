package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path

/** The shelf's folder as the server reads it, and where two texts of a catalogue differ. JUnit, as in this module. */
class CataloguesTest {
    @Test
    fun `every catalogue in the folder is read by its name on the shelf, folders and all`(@TempDir shelf: Path) {
        Files.writeString(shelf.resolve("structures.json"), "{}\n")
        Files.createDirectories(shelf.resolve("dialogues"))
        Files.writeString(shelf.resolve("dialogues").resolve("letter.json"), "{ \"title\": \"A letter\" }\n")
        Files.writeString(shelf.resolve("notes.txt"), "not a catalogue")

        assertEquals(
            mapOf("structures" to "{}\n", "dialogues/letter" to "{ \"title\": \"A letter\" }\n"),
            FolderCatalogues(shelf).read(),
        )
    }

    @Test
    fun `the real shelf holds the structures`() {
        assertTrue("structures" in FolderCatalogues(Path.of("../../world/catalogues")).read())
    }

    @Test
    fun `a change is named by where it is, a field at a time, and a list is one place`() {
        val before = """{ "types": { "castle": { "yields": { "naturalDomain": [3, 5, 8] }, "sightKm": [34] }, "mill": {} } }"""
        val after = """{ "types": { "castle": { "yields": { "naturalDomain": [4, 5, 8] }, "sightKm": [34] }, "fort": {} } }"""

        assertEquals(
            listOf("types.castle.yields.naturalDomain", "types.mill", "types.fort"),
            CatalogueDiff.changes(before, after),
        )
    }

    @Test
    fun `the same catalogue written another way has not changed, and one that is not JSON has changed everywhere`() {
        assertEquals(emptyList<String>(), CatalogueDiff.changes("""{"a": [1, 2]}""", "{\n  \"a\": [1,2]\n}\n"))
        assertEquals(listOf("the whole file"), CatalogueDiff.changes("{}", "{ broken"))
    }
}

/** The one form every revision is written in. */
class CatalogueTextTest {
    @Test
    fun `the catalogue of structures, written by hand, is already in it, byte for byte`() {
        val text = java.io.File("../../world/catalogues/structures.json").readText()
        val formatted = CatalogueText.format(text)
        val differs = text.lines().zip(formatted.lines()).indexOfFirst { (was, now) -> was != now }

        assertEquals(-1, differs, "line ${differs + 1}:\n${text.lines().getOrNull(differs)}\n${formatted.lines().getOrNull(differs)}")
        assertEquals(text, formatted)
    }

    @Test
    fun `plain values stay on one line, what holds more opens out when it does not fit, and fields keep their order`() {
        val long = "x".repeat(130)
        val formatted = CatalogueText.format(
            """{"b":[1,2.5],"a":{"c":true,"d":null,"e":"$long"},"f":[{"g":[1]},{"h":"$long"}],"none":{}}""",
        )

        assertEquals(
            listOf(
                """{""",
                """  "b": [1, 2.5],""",
                """  "a": { "c": true, "d": null, "e": "$long" },""",
                """  "f": [""",
                """    { "g": [1] },""",
                """    { "h": "$long" }""",
                """  ],""",
                """  "none": {}""",
                """}""",
                "",
            ),
            formatted.lines(),
        )
    }

    @Test
    fun `a word keeps its accents, and its quotes are escaped`() {
        assertEquals("{ \"words\": \"Zürich, \\\"the city\\\"\" }\n", CatalogueText.format("""{"words":"Zürich, \"the city\""}"""))
    }
}

/** The balance as the server reads it, held to the same fixture as the world package's reader. */
class BalanceFileTest {
    @Test
    fun `the fixture reads as it says, number for number`() {
        val balance = BalanceFile.parse(java.io.File("../../contracts/fixtures/balance.json").readText())

        assertEquals(12, balance.roll.price)
        assertEquals(4, balance.roll.hand)
        assertEquals(listOf(60, 30, 9, 1), villages.domain.Rarity.entries.map { balance.roll.odds.getValue(it) })
        assertEquals(listOf(20L, 50L, 150L, 500L), villages.domain.Rarity.entries.map { balance.roll.grants.getValue(it) })
        assertEquals(villages.application.Balance.Omens(365, 80, 0.2, 300.0, 120.0, 2, 100.0, 1), balance.omens)
        assertEquals(3_500_000.0, balance.islands.smallerThanKm2)
        assertEquals(16..60, balance.newcomers.ages)
        assertEquals(
            villages.domain.challenge.ChallengeRules(80.0, 12.0, 0.25, 0.4, 15.0, villages.domain.challenge.SliceStart(40.0, 60.0, 2)),
            balance.challenge,
        )
        assertEquals(villages.application.Balance.HouseBots(250, 50.0, 5.0), balance.houseBots)
    }

    @Test
    fun `the real balance reads, holds within itself, and is in the one form`() {
        val text = java.io.File("../../world/catalogues/balance.json").readText()

        BalanceFile.parse(text).check()
        assertEquals(text, CatalogueText.format(text))
    }

    @Test
    fun `a number it cannot read refuses the file, naming where`() {
        val text = java.io.File("../../contracts/fixtures/balance.json").readText().replace("\"hand\": 4", "\"hand\": \"four\"")

        val refused = org.junit.jupiter.api.assertThrows<IllegalArgumentException> { BalanceFile.parse(text) }
        assertEquals("world/catalogues/balance.json: no roll.hand the server can read", refused.message)
    }

    @Test
    fun `a challenge's number that breaks its rule refuses the file, naming the group and the rule`() {
        val text = java.io.File("../../contracts/fixtures/balance.json").readText().replace("\"tugEnds\": 80", "\"tugEnds\": 0")

        val refused = org.junit.jupiter.api.assertThrows<IllegalArgumentException> { BalanceFile.parse(text) }
        assertEquals("world/catalogues/balance.json: challenge: the tug runs some way either side of the middle, not 0.0", refused.message)
    }

    @Test
    fun `odds that do not add up to a hundred are refused by the shelf's check`() {
        val text = java.io.File("../../contracts/fixtures/balance.json").readText().replace("\"common\": 60", "\"common\": 61")

        val refused = org.junit.jupiter.api.assertThrows<villages.application.CatalogueRefused> { BalanceFile.parse(text).check() }
        assertEquals("world/catalogues/balance.json: roll.odds are chances out of a hundred, and add up to 101", refused.message)
    }
}
