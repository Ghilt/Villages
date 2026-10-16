package villages.app

import villages.application.CatalogueFiles
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.extension
import kotlin.io.path.invariantSeparatorsPathString
import kotlin.io.path.isRegularFile
import kotlin.io.path.readText

/**
 * The catalogue files in a folder, `world/catalogues/`: every `.json` in it and in its folders, by its path under it
 * without the `.json`, `structures` or `dialogues/letter`, read whole as UTF-8. See decision record 0097.
 */
class FolderCatalogues(private val folder: Path) : CatalogueFiles {
    override fun read(): Map<String, String> = Files.walk(folder).use { paths ->
        paths.filter { it.isRegularFile() && it.extension == "json" }
            .toList()
            .associate { file -> nameOf(file) to file.readText(Charsets.UTF_8) }
    }

    private fun nameOf(file: Path): String = folder.relativize(file).invariantSeparatorsPathString.removeSuffix(".json")
}
