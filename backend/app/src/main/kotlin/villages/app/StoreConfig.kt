package villages.app

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.Faults
import villages.occurrent.EventWorld
import villages.occurrent.InMemoryWorld
import villages.occurrent.MongoWorld
import java.nio.file.Files
import java.nio.file.Path

private val storeLog = LoggerFactory.getLogger("villages.store")

/**
 * Where the world is kept, chosen here and nowhere else: in memory unless told otherwise, which is what every
 * test of the app wants, and in MongoDB with `villages.store=mongo`, which the quick start passes whenever
 * Docker is running. Nothing that is handed the ports can tell which. See decision record 0091.
 */
@Configuration
class StoreConfig {
    /** The world, whose feed says on `faults` what its subscribers throw. */
    @Bean(destroyMethod = "close")
    fun world(
        faults: Faults,
        @Value("\${villages.store:memory}") store: String,
        @Value("\${villages.mongo.connection:$LOCAL_MONGO}") connection: String,
        @Value("\${villages.mongo.database:}") database: String,
    ): EventWorld = when (store) {
        "memory" -> InMemoryWorld(faults)
        "mongo" -> MongoWorld(connection, database.ifBlank { databaseFor(Path.of(CHECKOUT)) }, faults)
        else -> error("villages.store is '$store', and it can be memory or mongo")
    }.also { world -> storeLog.info("the world is kept {}", world.keptIn) }

    private companion object {
        /** The stack in `infra/docker-compose.yml`, and a server told to use it says so in five seconds if it is not up. */
        const val LOCAL_MONGO = "mongodb://localhost:27017/?replicaSet=rs0&serverSelectionTimeoutMS=5000"

        /** The checkout the server runs in: it is started in `backend/app`, as the folders it reads assume. */
        const val CHECKOUT = "../.."
    }
}

/** The longest name MongoDB takes for a database. */
private const val LONGEST = 63

/**
 * The database a checkout keeps its world in: `villages` for the main checkout and `villages-<folder>` for a
 * worktree, told apart as git tells them, by `.git` being the repository itself or a file pointing at it. The same
 * name the ports are worked out from (0031), so a server keeps to its own tree's world however it was started.
 */
internal fun databaseFor(checkout: Path): String {
    val root = checkout.toAbsolutePath().normalize()
    if (Files.isDirectory(root.resolve(".git"))) {
        return "villages"
    }
    val folder = root.fileName.toString().lowercase().replace(Regex("[^a-z0-9-]"), "-")
    return "villages-$folder".take(LONGEST)
}
