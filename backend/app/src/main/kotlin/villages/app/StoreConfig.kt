package villages.app

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.Faults
import villages.occurrent.EventWorld
import villages.occurrent.InMemoryWorld
import villages.occurrent.MongoWorld
import villages.protocol.Cell
import villages.rabbit.Broker
import villages.rabbit.CarriedWorld
import villages.rabbit.RoutingKeys
import java.nio.file.Files
import java.nio.file.Path

private val storeLog = LoggerFactory.getLogger("villages.store")

/**
 * Where the world is kept, and whether RabbitMQ carries it, chosen here and nowhere else: in memory and in-process
 * unless told otherwise, which is what every test of the app wants; in MongoDB with `villages.store=mongo`, and
 * carried by RabbitMQ in the tree's own virtual host with `villages.broker=rabbit`, both of which the quick start
 * passes whenever the stack is up. Nothing that is handed the ports can tell which. See decision records 0092 and
 * 0094.
 */
@Configuration
class StoreConfig {
    /** The world, whose feed says on `faults` what its subscribers throw. */
    @Bean(destroyMethod = "close")
    @Suppress("LongParameterList")
    fun world(
        faults: Faults,
        @Value("\${villages.store:memory}") store: String,
        @Value("\${villages.mongo.connection:$LOCAL_MONGO}") connection: String,
        @Value("\${villages.mongo.database:}") database: String,
        @Value("\${villages.broker:in-process}") broker: String,
        @Value("\${villages.rabbit.uri:$LOCAL_RABBIT}") rabbit: String,
        @Value("\${villages.rabbit.management:$LOCAL_MANAGEMENT}") management: String,
        @Value("\${villages.rabbit.vhost:}") virtualHost: String,
    ): EventWorld {
        check(broker in BROKERS) { "villages.broker is '$broker', and it can be ${BROKERS.joinToString(" or ")}" }
        check(broker != "rabbit" || store == "mongo") {
            "villages.broker=rabbit needs villages.store=mongo: in memory, a wipe cannot wait for what the broker " +
                "still holds. See decision record 0094."
        }
        val kept = when (store) {
            "memory" -> InMemoryWorld(faults)
            "mongo" -> MongoWorld(connection, database.ifBlank { databaseFor(Path.of(CHECKOUT)) }, faults)
            else -> error("villages.store is '$store', and it can be memory or mongo")
        }
        val world = if (kept is MongoWorld && broker == "rabbit") {
            val tree = Broker(rabbit, management, virtualHost.ifBlank { kept.database })
            try {
                CarriedWorld(kept, tree, RoutingKeys { place -> Cell.of(place.lat, place.lon).quadkey })
            } catch (@Suppress("TooGenericExceptionCaught") unanswered: Exception) {
                kept.close()
                throw unanswered
            }
        } else {
            kept
        }
        return world.also { sayWhereAndWhat(it) }
    }

    /**
     * Says where the world is kept, and reads every event in it once, so that one this code cannot read is said as
     * the server starts rather than found by a house that refuses every command. See decision record 0036.
     */
    private fun sayWhereAndWhat(world: EventWorld) {
        storeLog.info("the world is kept {}", world.keptIn)
        val unreadable = world.unreadable()
        if (unreadable.none) {
            storeLog.info("its {} events can all be read", unreadable.of)
        } else {
            val broken = unreadable.brokenAt?.let { ", and the store could not be read back $it" } ?: ""
            storeLog.warn(
                "{} of its {} events cannot be read, the first {}{}: wipe this world from the debug panel",
                unreadable.events, unreadable.of, unreadable.first, broken,
            )
        }
    }

    internal companion object {
        /** The stack in `infra/docker-compose.yml`, and a server told to use it says so in five seconds if it is not up. */
        const val LOCAL_MONGO = "mongodb://localhost:27017/?replicaSet=rs0&serverSelectionTimeoutMS=5000"

        /** The same stack's RabbitMQ, as the user it makes, and its management page, which makes virtual hosts. */
        const val LOCAL_RABBIT = "amqp://villages:villages@localhost:5672"
        const val LOCAL_MANAGEMENT = "http://localhost:15672"

        val BROKERS = listOf("in-process", "rabbit")

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
