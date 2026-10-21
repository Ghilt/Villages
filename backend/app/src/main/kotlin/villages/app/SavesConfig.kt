package villages.app

import org.springframework.beans.factory.ObjectProvider
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.Follower
import villages.application.Opening
import villages.application.WorldSaves
import villages.occurrent.EventWorld
import villages.occurrent.FileSaves
import java.nio.file.Files
import java.nio.file.Path
import java.time.Clock
import kotlin.io.path.exists
import kotlin.io.path.readText

/**
 * The world's saves, kept in `.saves/` beside the shared `.git`, where every tree sees them as it sees `.sessions/`:
 * a save made in one tree loads in any. `villages.saves` names another folder. See decision record 0101.
 */
@Configuration
class SavesConfig {
    /**
     * A load folds every follower again from the save, and then opens the world, as a wipe does: it takes on the
     * catalogues the server runs on, so the world records the numbers in force now when they differ from the save's,
     * and makes any house bot the save lacks (0108).
     */
    @Bean
    fun worldSaves(
        world: EventWorld,
        clock: Clock,
        followers: ObjectProvider<Follower>,
        opening: Opening,
        @Value("\${villages.saves:}") folder: String,
    ): WorldSaves = FileSaves(
        folder = folder.ifBlank { null }?.let(Path::of) ?: savesBesideTheSharedGit(Path.of(StoreConfig.CHECKOUT)),
        world = world,
        clock = clock,
        followers = { followers.orderedStream().toList() },
        loaded = { opening.open() },
    )
}

/**
 * `.saves/` in the folder the shared `.git` is in: the main checkout's, from it or from any of its worktrees. A
 * worktree's `.git` is a file naming its own folder in the shared one, and that folder's `commondir` names the shared
 * one, relative to it.
 */
internal fun savesBesideTheSharedGit(checkout: Path): Path {
    val git = checkout.resolve(".git")
    val shared = if (Files.isRegularFile(git)) {
        val own = checkout.resolve(git.readText().trim().removePrefix("gitdir:").trim()).normalize()
        val common = own.resolve("commondir")
        if (common.exists()) own.resolve(common.readText().trim()).normalize() else own
    } else {
        git
    }
    return shared.toAbsolutePath().normalize().parent.resolve(".saves")
}
