package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path

/** JUnit rather than Kotest here, as in the rest of this module. */
class FolderPortraitsTest {
    @Test
    fun `every picture's key is its name without the png, and nothing else in the folder is one`(@TempDir folder: Path) {
        Files.writeString(folder.resolve("woman-02.png"), "")
        Files.writeString(folder.resolve("man-01.png"), "")
        Files.writeString(folder.resolve("notes.txt"), "")

        assertEquals(listOf("man-01", "woman-02"), FolderPortraits(folder).keys())
    }

    @Test
    fun `a folder that is not there means no portraits rather than a server that will not start`(@TempDir folder: Path) {
        assertEquals(emptyList<String>(), FolderPortraits(folder.resolve("nowhere")).keys())
    }

    /** Where the app looks by default, from the module directory Gradle runs it in. */
    @Test
    fun `the repository's own folder is found from where the server runs`() {
        val keys = FolderPortraits(Path.of("../../world/portraits")).keys()

        assertTrue(keys.any { it.startsWith("woman-") }, "a portrait for a woman in $keys")
        assertTrue(keys.any { it.startsWith("man-") }, "a portrait for a man in $keys")
    }
}
