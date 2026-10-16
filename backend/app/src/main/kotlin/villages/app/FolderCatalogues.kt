package villages.app

import villages.application.CatalogueFiles
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import kotlin.io.path.extension
import kotlin.io.path.invariantSeparatorsPathString
import kotlin.io.path.isRegularFile
import kotlin.io.path.readText
import kotlin.io.path.writeText

/**
 * The catalogue files in a folder, `world/catalogues/`: every `.json` in it and in its folders, by its path under it
 * without the `.json`, `structures` or `dialogues/letter`, read whole as UTF-8. A file is written beside itself and
 * moved over the old one in a single step, so nothing reading the folder ever sees half of it. See 0097.
 */
class FolderCatalogues(private val folder: Path) : CatalogueFiles {
    override fun read(): Map<String, String> = Files.walk(folder).use { paths ->
        paths.filter { it.isRegularFile() && it.extension == "json" }
            .toList()
            .associate { file -> nameOf(file) to file.readText(Charsets.UTF_8) }
    }

    override fun write(catalogue: String, text: String) {
        val file = folder.resolve("$catalogue.json").normalize()
        require(file.startsWith(folder.normalize())) { "$catalogue is not on the shelf" }
        Files.createDirectories(file.parent)
        val beside = file.resolveSibling(".${file.fileName}.saving")
        beside.writeText(text, Charsets.UTF_8)
        Files.move(beside, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
    }

    private fun nameOf(file: Path): String = folder.relativize(file).invariantSeparatorsPathString.removeSuffix(".json")
}
