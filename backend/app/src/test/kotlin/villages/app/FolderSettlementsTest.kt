package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import villages.application.settlements.SettlementSite
import villages.domain.Location
import villages.domain.StructureType
import java.io.File
import java.nio.file.Files
import java.nio.file.Path

/**
 * The settlement sites as the world package files them, read by the server: the shared fixture, which the world
 * package's own writer writes and its test holds it to. See decision record 0114.
 */
class FolderSettlementsTest {
    private val fixture = File("../../contracts/fixtures/settlements.json").readText()

    private fun file(masters: Path, master: String, text: String = fixture): Path {
        val own = Files.createDirectories(masters.resolve(master))
        return Files.writeString(own.resolve("settlements.json"), text)
    }

    @Test
    fun `the shared fixture reads as the world package filed it, every site`(@TempDir masters: Path) {
        file(masters, "fixture")

        assertEquals(
            listOf(
                SettlementSite(
                    "ruin:Q1792:0", StructureType.VILLAGE, 3, "village by the ruins of Dantzic", Location(54.42, 18.71), "Q1792",
                ),
                SettlementSite(
                    "site:1130:325",
                    StructureType.FISHING_VILLAGE,
                    1,
                    "fishing village on the Lake of Geneva",
                    Location(46.4512346, 6.5123457),
                    null,
                ),
            ),
            FolderSettlements(masters).of("fixture"),
        )
    }

    @Test
    fun `a site it cannot read is left out, and the rest are read`(@TempDir masters: Path) {
        file(masters, "fixture", fixture.replace("\"type\": \"village\"", "\"type\": \"castle\""))

        assertEquals(listOf("site:1130:325"), FolderSettlements(masters).of("fixture")!!.map { it.id })
    }

    @Test
    fun `a master with no sites has none, and a name that is not a master is never a path`(@TempDir masters: Path) {
        assertNull(FolderSettlements(masters).of("fixture"))
        assertNull(FolderSettlements(masters).of("../escape"))
    }

    @Test
    fun `a file written again is read again`(@TempDir masters: Path) {
        val written = file(masters, "fixture")
        val sites = FolderSettlements(masters)
        assertEquals(2, sites.of("fixture")!!.size)

        Files.writeString(written, fixture.replace("\"id\": \"site:1130:325\"", "\"id\": 7"))
        Files.setLastModifiedTime(written, java.nio.file.attribute.FileTime.fromMillis(System.currentTimeMillis() + 5_000))

        assertEquals(1, sites.of("fixture")!!.size)
    }
}
