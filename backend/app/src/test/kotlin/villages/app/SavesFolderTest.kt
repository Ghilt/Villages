package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path

/** Where a checkout keeps its world's saves: beside the shared `.git`, whichever tree it is. See decision record 0101. */
class SavesFolderTest {
    @Test
    fun `the main checkout keeps them beside its own git folder`(@TempDir at: Path) {
        val main = Files.createDirectories(at.resolve("Villages"))
        Files.createDirectories(main.resolve(".git"))

        assertEquals(main.toAbsolutePath().resolve(".saves"), savesBesideTheSharedGit(main))
    }

    @Test
    fun `a worktree keeps them in the main checkout, which its git folder's commondir names`(@TempDir at: Path) {
        val main = Files.createDirectories(at.resolve("Villages"))
        val own = Files.createDirectories(main.resolve(".git").resolve("worktrees").resolve("world-saves-1a2b3c"))
        Files.writeString(own.resolve("commondir"), "../..\n")
        val tree = Files.createDirectories(main.resolve(".claude").resolve("worktrees").resolve("world-saves-1a2b3c"))
        Files.writeString(tree.resolve(".git"), "gitdir: ${own.toAbsolutePath()}\n")

        assertEquals(main.toAbsolutePath().resolve(".saves"), savesBesideTheSharedGit(tree.resolve("backend/app/../..")))
    }
}
