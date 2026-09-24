package villages.app

import villages.application.Portraits
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.isDirectory
import kotlin.io.path.name

/**
 * The portraits port over a folder of pictures: every PNG's name without the `.png`, listed each time it is
 * asked, so a picture Adam saves into the folder is given out without a restart. No folder means no
 * portraits, and a character appears with none rather than the server refusing to start.
 *
 * The folder is the repository's `world/portraits/`, which ties a running server to a checkout. That is a
 * development coupling, named as one; a deployed server will be handed its pictures some other way.
 */
class FolderPortraits(private val folder: Path) : Portraits {
    override fun keys(): List<String> {
        if (!folder.isDirectory()) {
            return emptyList()
        }
        return Files.list(folder).use { files ->
            files.map { it.name }.filter { it.endsWith(".png") }.map { it.removeSuffix(".png") }.toList()
        }.sorted()
    }
}
