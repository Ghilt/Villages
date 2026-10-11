package villages.occurrent

import com.mongodb.MongoTimeoutException
import com.mongodb.client.MongoClient
import com.mongodb.client.MongoClients
import org.occurrent.eventstore.mongodb.nativedriver.EventStoreConfig
import org.occurrent.eventstore.mongodb.nativedriver.MongoEventStore
import org.occurrent.mongodb.timerepresentation.TimeRepresentation
import org.occurrent.retry.RetryStrategy
import org.occurrent.subscription.mongodb.nativedriver.blocking.NativeMongoSubscriptionModel
import villages.application.CharacterCommandExecutor
import villages.application.EventFeed
import villages.application.FaultBoard
import villages.application.Faults
import villages.application.HouseCommandExecutor
import villages.application.Resettable
import villages.application.WipeGate
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * The world kept in MongoDB, in one database of its own: a tree keeps to the database named after it, so two
 * sessions running at once never see each other's world (decision record 0091). What it holds outlives the
 * server, which is the whole of the difference from `InMemoryWorld`; the ports over it are the same code.
 *
 * The database has to be a replica set, because the feed's subscriptions are its change streams (0002).
 * Whatever acts on it and throws is said on `faults`, as in memory.
 */
class MongoWorld(
    connection: String,
    val database: String,
    val faults: Faults = FaultBoard(),
) : EventWorld {
    private val client: MongoClient = MongoClients.create(connection)

    /** A thread for every subscription, each waiting on its own change stream. */
    private val dispatcher: ExecutorService = Executors.newCachedThreadPool()

    /**
     * Made first, because making it makes the collection and its indexes that the subscriptions watch, and so it is
     * the first thing to find out that nothing is answering, which it says in words rather than in the driver's.
     */
    internal val store: MongoEventStore = try {
        MongoEventStore(client, database, EVENTS, EventStoreConfig(TIME))
    } catch (unanswered: MongoTimeoutException) {
        client.close()
        throw IllegalStateException(
            "MongoDB did not answer at $connection, so the world cannot be kept in $database. It runs in Docker: " +
                "docker compose -f infra/docker-compose.yml up -d",
            unanswered,
        )
    }

    private val subscriptions = NativeMongoSubscriptionModel(
        client.getDatabase(database), EVENTS, TIME, dispatcher, RetryStrategy.fixed(200),
    )
    private val converter = Events.converter()

    override val gate = WipeGate()

    override val executor: HouseCommandExecutor = OccurrentHouseCommandExecutor(store, converter, gate)
    override val characterExecutor: CharacterCommandExecutor = OccurrentCharacterCommandExecutor(store, converter, gate)
    override val feed: EventFeed = OccurrentEventFeed(subscriptions, store, converter, faults, gate)

    override val keptIn = "in MongoDB, database $database, which outlives the server"

    /**
     * The wipe, in the gate as in memory, but without waiting for the feed to hand on what was written before it:
     * a change stream has nothing like the in-memory model's wait, so an event still on its way when the wipe
     * begins can reach a read model after it was emptied.
     */
    override fun wipe(folded: Iterable<Resettable>): Int = gate.wiping {
        store.wipeEveryStream().also { folded.forEach(Resettable::reset) }
    }

    override fun close() {
        subscriptions.shutdown()
        dispatcher.shutdownNow()
        client.close()
    }

    private companion object {
        const val EVENTS = "events"

        /**
         * An event's time kept as the text it was written as, to the nanosecond, as the store in memory keeps it,
         * so it is read as it was written (0074). Kept as a date, Occurrent refuses any time finer than a
         * millisecond outright, and the server's clock is finer than that: every command would be refused.
         */
        val TIME = TimeRepresentation.RFC_3339_STRING
    }
}
