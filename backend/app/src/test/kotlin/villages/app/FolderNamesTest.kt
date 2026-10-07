package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import tools.jackson.databind.json.JsonMapper
import villages.application.fate.NameKind
import villages.application.fate.RegionKind
import villages.domain.Location
import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.FileTime
import java.util.Base64

/**
 * The names as the world package files them, read by the server: the shared fixture, which the world package's own
 * encoder writes and its test holds it to. JUnit rather than Kotest here, as in the rest of this module. See 0085.
 */
class FolderNamesTest {
    private val json = JsonMapper.builder().build()
    private val fixture = json.readTree(File("../../contracts/fixtures/names.json"))
    private val filed = json.writeValueAsString(fixture["file"])
    private val layers = Base64.getDecoder().decode(fixture["regions"].asString())

    /** Files a master's names as `world:names` does: the regions, then `names.json` last. */
    private fun file(masters: Path, master: String, names: String = filed, regions: ByteArray = layers): Path {
        val own = Files.createDirectories(masters.resolve(master))
        Files.write(own.resolve("regions.bin"), regions)
        return Files.writeString(own.resolve("names.json"), names)
    }

    @Test
    fun `the shared fixture reads as the world package filed it, every name and both layers`(@TempDir masters: Path) {
        file(masters, "fixture")
        val names = FolderNames(masters).of("fixture")!!

        val dantzic = names.names.single { it.kind == NameKind.TOWN }
        assertEquals(listOf("Q1792", "Dantzic", "Gdańsk"), listOf(dantzic.id, dantzic.name, dantzic.also))
        assertTrue(dantzic.of1790)
        assertEquals(Location(54.36, 18.64), dantzic.at)
        val vistula = names.names.single { it.kind == NameKind.RIVER }
        assertFalse(vistula.of1790)
        assertEquals(listOf(Location(54.35, 18.95), Location(53.5, 19.1), Location(51.48, 21.9)), vistula.lines.single())
        val peak = names.names.single { it.kind == NameKind.PEAK }
        assertEquals(4808.0, peak.elevation)
        assertEquals(1.0, peak.rank)
        assertEquals(Location(-45.83, -6.87), peak.at)
        assertEquals(Location(45.83, 6.87), peak.earth)

        assertEquals(listOf("Baltic Sea", "Pomerania", "Sea of Azov"), names.regions.map { it.name })
        assertEquals("Pomerania", names.regionAt(Location(45.0, 45.0), RegionKind.LAND)?.name)
        assertEquals("Baltic Sea", names.regionAt(Location(45.0, 45.0), RegionKind.SEA)?.name)
        assertEquals("Baltic Sea", names.regionAt(Location(45.0, 135.0), RegionKind.SEA)?.name)
        assertNull(names.regionAt(Location(45.0, 135.0), RegionKind.LAND))
        assertNull(names.regionAt(Location(-45.0, -135.0), RegionKind.SEA))
        assertEquals("Dantzic", names.near(NameKind.TOWN, Location(54.4, 18.7), 25.0).single().name.name)
    }

    @Test
    fun `a master with no names has none, and neither has a name that is not the folder's own`(@TempDir masters: Path) {
        file(masters, "fixture")
        Files.createDirectories(masters.resolve("bare"))
        val names = FolderNames(masters)

        assertNull(names.of("bare"))
        assertNull(names.of("nowhere"))
        assertNull(names.of("../fixture"))
        assertNull(names.of("fixture/.."))
    }

    @Test
    fun `names filed again are read again, and regions that do not fit the squares are left out`(@TempDir masters: Path) {
        val written = file(masters, "fixture")
        val names = FolderNames(masters)
        assertEquals(3, names.of("fixture")!!.names.size)

        file(masters, "fixture", filed.replace("Dantzic", "Danzig"), ByteArray(5))
        Files.setLastModifiedTime(written, FileTime.fromMillis(Files.getLastModifiedTime(written).toMillis() + 2000))
        val again = names.of("fixture")!!

        assertEquals("Danzig", again.names.first().name)
        assertNull(again.regionAt(Location(45.0, 45.0), RegionKind.LAND))
    }
}
