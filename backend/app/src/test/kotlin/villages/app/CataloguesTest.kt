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
