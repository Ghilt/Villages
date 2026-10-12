package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import villages.application.FaultBoard
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path

/**
 * Which database a checkout keeps its world in, and which choices of store and broker a start refuses. JUnit rather
 * than Kotest here, as in the rest of this module.
 */
class StoreConfigTest {
    @Test
    fun `the main checkout, whose git folder is the repository itself, keeps its world in villages`(@TempDir at: Path) {
        val main = Files.createDirectories(at.resolve("Villages"))
        Files.createDirectories(main.resolve(".git"))

        assertEquals("villages", databaseFor(main))
    }

    @Test
    fun `a worktree, whose git is a file pointing at the repository, keeps its world under its own name`(@TempDir at: Path) {
        val tree = Files.createDirectories(at.resolve("docker-roadmap-impl-03b5ca"))
        Files.writeString(tree.resolve(".git"), "gitdir: E:/Code/Villages/.git/worktrees/docker-roadmap-impl-03b5ca")

        assertEquals("villages-docker-roadmap-impl-03b5ca", databaseFor(tree))
    }

    @Test
    fun `the server, started two below its checkout, finds the checkout and not a folder inside it`(@TempDir at: Path) {
        val tree = Files.createDirectories(at.resolve("fog-of-war-mechanic-3c9f45"))
        Files.writeString(tree.resolve(".git"), "gitdir: elsewhere")
        val app = Files.createDirectories(tree.resolve("backend").resolve("app"))

        assertEquals("villages-fog-of-war-mechanic-3c9f45", databaseFor(app.resolve("../..")))
    }

    @Test
    fun `a name MongoDB would refuse is made one it takes, and no longer than it takes`(@TempDir at: Path) {
        val tree = Files.createDirectories(at.resolve("Odd Name.With\$Things-" + "x".repeat(80)))
        Files.writeString(tree.resolve(".git"), "gitdir: elsewhere")

        val name = databaseFor(tree)
        assertEquals(63, name.length)
        assertEquals("villages-odd-name-with-things-xxxx", name.take(34))
    }

    @Test
    fun `RabbitMQ is refused for a world in memory, whose wipe cannot wait for what the broker holds`() {
        val refused = assertThrows(IllegalStateException::class.java) { world(store = "memory", broker = "rabbit") }

        assertTrue(refused.message!!.startsWith("villages.broker=rabbit needs villages.store=mongo"))
    }

    @Test
    fun `a broker it does not know is refused, and the two it does are named`() {
        val refused = assertThrows(IllegalStateException::class.java) { world(store = "memory", broker = "kafka") }

        assertEquals("villages.broker is 'kafka', and it can be in-process or rabbit", refused.message)
    }

    private fun world(store: String, broker: String) =
        StoreConfig().world(FaultBoard(), store, "", "", broker, "", "", "").close()
}
