package villages.app

import villages.application.Stands
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.FileTime
import java.util.concurrent.ConcurrentHashMap
import kotlin.io.path.getLastModifiedTime
import kotlin.io.path.isDirectory
import kotlin.io.path.isRegularFile
import kotlin.io.path.name

/**
 * The stands port over the folder the world generator writes them to, `world/stands/`: for each master, one file
 * of eight-byte stand records for every zoom 7 tile anything stands in, `<master>/biome/<x>/<y>.bin`, and a
 * `stands.json` written last. A tile is read the first time it is asked for and kept; when a master's
 * `stands.json` has been written since, every tile of that master is let go, so furnishing it again is seen
 * without a restart. A tile with no file is one nothing stands in. A master with no stands has none at all, and
 * so has a name that is not one of the folder's own: a name from a browser picks among the folder's masters and
 * is never made into a path. See 0025.
 *
 * The folder is outside the one the page's world is served from, so nothing but the gateway can hand a page a
 * stand. It ties a running server to a checkout, as the portraits do: a development coupling, named as one. See
 * decision records 0054 and 0067.
 */
class FolderStands(private val masters: Path) : Stands {
    private class Furnished(val at: FileTime) {
        val tiles = ConcurrentHashMap<Int, ByteArray>()
    }

    private val furnished = ConcurrentHashMap<String, Furnished>()

    override fun of(master: String, x: Int, y: Int): ByteArray? {
        val layer = layerOf(master) ?: return null
        val marker = layer.resolve("stands.json")
        if (!marker.isRegularFile()) {
            return null
        }
        if (x !in 0 until TILES || y !in 0 until TILES) {
            return ByteArray(0)
        }
        val at = marker.getLastModifiedTime()
        val held = furnished.compute(master) { _, was -> if (was?.at == at) was else Furnished(at) } ?: return null
        return held.tiles.computeIfAbsent(y * TILES + x) {
            val tile = layer.resolve(x.toString()).resolve("$y.bin")
            if (tile.isRegularFile()) Files.readAllBytes(tile) else ByteArray(0)
        }
    }

    /** The biome layer of one of the folder's own masters, found among its entries by name. */
    private fun layerOf(master: String): Path? {
        if (!masters.isDirectory()) {
            return null
        }
        val own = Files.list(masters).use { entries ->
            entries.filter { it.name == master && it.isDirectory() }.findFirst().orElse(null)
        } ?: return null
        return own.resolve("biome")
    }

    private companion object {
        /** How many zoom 7 tiles the world is across and down. */
        const val TILES = 128
    }
}
