package villages.app

import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.FileTime

/** JUnit rather than Kotest here, as in the rest of this module. */
class FolderStandsTest {
    private val someStands = ByteArray(16) { it.toByte() }

    /** Writes a master's stands as the generator does: the tiles, then `stands.json` last. */
    private fun furnish(
        masters: Path,
        master: String,
        tiles: Map<Pair<Int, Int>, ByteArray>,
        layerName: String = "biome",
    ): Path {
        val layer = masters.resolve(master).resolve(layerName)
        for ((at, bytes) in tiles) {
            val file = layer.resolve(at.first.toString()).resolve("${at.second}.bin")
            Files.createDirectories(file.parent)
            Files.write(file, bytes)
        }
        Files.createDirectories(layer)
        return Files.writeString(layer.resolve("stands.json"), "{}")
    }

    @Test
    fun `a tile's records are read as the generator wrote them, and a tile with no file holds nothing`(@TempDir masters: Path) {
        furnish(masters, "terrain", mapOf((70 to 37) to someStands))
        val stands = FolderStands(masters)

        assertArrayEquals(someStands, stands.of("terrain", 70, 37))
        assertEquals(0, stands.of("terrain", 71, 37)?.size)
        assertEquals(0, stands.of("terrain", 128, 37)?.size)
    }

    @Test
    fun `a master with no stands has none, and neither has a name that is not the folder's own`(@TempDir masters: Path) {
        furnish(masters, "terrain", mapOf((70 to 37) to someStands))
        Files.createDirectories(masters.resolve("terrain_og"))
        val stands = FolderStands(masters)

        assertNull(stands.of("terrain_og", 70, 37))
        assertNull(stands.of("nowhere", 70, 37))
        assertNull(stands.of("../stands/terrain", 70, 37))
        assertNull(stands.of("terrain/biome/..", 70, 37))
    }

    @Test
    fun `a sprite map from before the stands left the page's folder is no master's stands`(@TempDir world: Path) {
        // The old place: beside the biome raster, under the folder the page is served from.
        val old = world.resolve("terrain").resolve("sprites").resolve("biome")
        Files.createDirectories(old.resolve("stands").resolve("70"))
        Files.write(old.resolve("stands").resolve("70").resolve("37.bin"), someStands)
        Files.writeString(old.resolve("map.json"), "{}")

        assertNull(FolderStands(world).of("terrain", 70, 37))
    }

    @Test
    fun `furnishing a master again is seen without a restart`(@TempDir masters: Path) {
        val marker = furnish(masters, "terrain", mapOf((70 to 37) to someStands))
        val stands = FolderStands(masters)
        assertArrayEquals(someStands, stands.of("terrain", 70, 37))

        val others = ByteArray(8) { 9 }
        furnish(masters, "terrain", mapOf((70 to 37) to others))
        Files.setLastModifiedTime(marker, FileTime.fromMillis(Files.getLastModifiedTime(marker).toMillis() + 60_000))

        assertArrayEquals(others, stands.of("terrain", 70, 37))
    }

    @Test
    fun `a folder that is not there means no stands rather than a server that will not start`(@TempDir masters: Path) {
        assertNull(FolderStands(masters.resolve("nowhere")).of("terrain", 70, 37))
    }

    @Test
    fun `each layer is read from its own folder, and a layer it does not know is never looked for`(@TempDir masters: Path) {
        val ruins = ByteArray(8) { (it + 100).toByte() }
        val roads = ByteArray(16) { (it + 40).toByte() }
        furnish(masters, "terrain", mapOf((70 to 37) to someStands))
        furnish(masters, "terrain", mapOf((70 to 37) to ruins), "ruins")
        furnish(masters, "terrain", mapOf((70 to 37) to roads), "roads")
        Files.createDirectories(masters.resolve("terrain").resolve("secrets"))
        Files.writeString(masters.resolve("terrain").resolve("secrets").resolve("stands.json"), "{}")
        val stands = FolderStands(masters)

        assertArrayEquals(someStands, stands.of("terrain", "biome", 70, 37))
        assertArrayEquals(ruins, stands.of("terrain", "ruins", 70, 37))
        assertArrayEquals(roads, stands.of("terrain", "roads", 70, 37))
        assertNull(stands.of("terrain", "secrets", 70, 37))
        assertNull(stands.of("terrain", "../terrain/biome", 70, 37))
    }

    @Test
    fun `a master with no ruins laid has none, and its scenery is still read`(@TempDir masters: Path) {
        furnish(masters, "terrain", mapOf((70 to 37) to someStands))
        val stands = FolderStands(masters)

        assertNull(stands.of("terrain", "ruins", 70, 37))
        assertArrayEquals(someStands, stands.of("terrain", 70, 37))
    }
}
