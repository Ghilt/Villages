package villages.app

import tools.jackson.databind.json.JsonMapper
import villages.application.fate.GroundMap
import villages.application.fate.GroundMaps
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.FileTime
import java.util.concurrent.ConcurrentHashMap
import kotlin.io.path.getLastModifiedTime
import kotlin.io.path.isDirectory
import kotlin.io.path.isRegularFile
import kotlin.io.path.name

/**
 * The ground port over the folder `world:ground` writes to, `world/ground/`: for each master a `ground.bin`, two
 * bytes a cell, and a `ground.json` saying how big the grid is and what each class number is called. A master's
 * map is read the first time it is asked for and kept until its `ground.json` is written again, so cutting it
 * again is seen without a restart. A name that is not one of the folder's own has none, and is never made into a
 * path: it picks among the folder's masters, as the stands do. See decision records 0084 and 0067.
 */
class FolderGround(private val masters: Path) : GroundMaps {
    private class Read(val at: FileTime, val map: GroundMap)

    private val read = ConcurrentHashMap<String, Read>()
    private val json = JsonMapper.builder().build()

    override fun of(master: String): GroundMap? {
        val own = ownFolder(masters, master) ?: return null
        val about = own.resolve("ground.json")
        val cells = own.resolve("ground.bin")
        if (!about.isRegularFile() || !cells.isRegularFile()) {
            return null
        }
        val at = about.getLastModifiedTime()
        return read.compute(master) { _, was -> if (was?.at == at) was else Read(at, load(about, cells)) }?.map
    }

    private fun load(about: Path, cells: Path): GroundMap {
        val said = json.readTree(about.toFile())
        val classes = said["classes"].properties().associate { (id, name) -> id.toInt() to name.asString() }
        return GroundMap(said["width"].asInt(), said["height"].asInt(), classes, Files.readAllBytes(cells))
    }
}

/**
 * A master's own folder among a folder of masters, picked by its name from what is there and never made from it, so
 * that a name a page sends cannot climb out of the folder; or null for a name that is not one of them.
 */
internal fun ownFolder(masters: Path, master: String): Path? {
    if (!masters.isDirectory()) {
        return null
    }
    return Files.list(masters).use { entries ->
        entries.filter { it.name == master && it.isDirectory() }.findFirst().orElse(null)
    }
}
