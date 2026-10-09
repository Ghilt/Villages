package villages.occurrent

import com.mongodb.MongoException
import com.mongodb.MongoTimeoutException
import com.mongodb.client.MongoClient
import com.mongodb.client.MongoClients
import org.occurrent.eventstore.mongodb.nativedriver.EventStoreConfig
import org.occurrent.eventstore.mongodb.nativedriver.MongoEventStore
import org.occurrent.filter.Filter
import org.occurrent.mongodb.timerepresentation.TimeRepresentation
import org.occurrent.retry.RetryStrategy
import org.occurrent.subscription.mongodb.nativedriver.blocking.NativeMongoSubscriptionModel
import villages.application.CharacterCommandExecutor
import villages.application.Fault
import villages.application.FaultBoard
import villages.application.Faults
import villages.application.HouseCommandExecutor
import villages.application.StructureCommandExecutor
import villages.application.Resettable
import villages.application.Unreadable
import villages.application.WipeGate
import villages.domain.StructureCatalogue
import java.time.Duration
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * The world kept in MongoDB, in one database of its own: a tree keeps to the database named after it, so two
 * sessions running at once never see each other's world (decision record 0092). What it holds outlives the
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

    /**
     * How a subscription that fails is started again: for ever, waiting longer each time up to five seconds, while the
     * failure is MongoDB's own - a connection lost, a restart, a failover - because those heal. Anything else is an
     * event the subscription cannot read back, which fails the same way at every restart, forty times a second when
     * let: that one is given up at once and said, and the subscription stops. Its world wants wiping and the server
     * starting again. See decision record 0036.
     */
    private val restarts = RetryStrategy.exponentialBackoff(Duration.ofMillis(200), Duration.ofSeconds(5), 2.0)
        .retryIf { it is MongoException }
        .onError { info, thrown ->
            if (!info.isRetryable) {
                faults.report(Fault("the feed", "an event a subscription could not read back, so it stopped", thrown))
            }
        }

    private val subscriptions =
        NativeMongoSubscriptionModel(client.getDatabase(database), EVENTS, TIME, dispatcher, restarts)
    private val converter = Events.converter()

    override val gate = WipeGate()

    override val executor: HouseCommandExecutor = OccurrentHouseCommandExecutor(store, converter, gate)
    override val characterExecutor: CharacterCommandExecutor = OccurrentCharacterCommandExecutor(store, converter, gate)
    override val feed = OccurrentEventFeed(subscriptions, store, converter, faults, gate)

    override fun structureExecutor(catalogue: StructureCatalogue): StructureCommandExecutor =
        OccurrentStructureCommandExecutor(store, converter, catalogue, gate)

    override val keptIn = "in MongoDB, database $database, which outlives the server"

    /**
     * Counted and deleted without reading a single event back, unlike in memory, so that a world holding one the
     * store cannot read - which is when a world most wants wiping - can still be wiped.
     */
    override fun wipe(folded: Iterable<Resettable>): Int = gate.wiping {
        store.count(Filter.all()).toInt().also {
            store.delete(Filter.all())
            handedOn()
            folded.forEach(Resettable::reset)
            reading = Unreadable.NONE
        }
    }

    /** The last reading of the whole store: made the first time it is asked, and nothing unreadable after a wipe. */
    @Volatile
    private var reading: Unreadable? = null

    override fun unreadable(): Unreadable = reading ?: store.readEverything(converter).also { reading = it }

    /**
     * Waits until every subscription has handed on what was written before the wipe, by a marker written after it,
     * which a change stream hands on after everything before it: the in-memory model's wait, which a change stream
     * has nothing like. The marker is deleted however the wait ends. One that never arrives is said, and the wipe goes
     * on without it rather than leaving the world half emptied, as in memory.
     */
    private fun handedOn() {
        val marker = aMarker()
        val stream = "marker:${marker.id}"
        try {
            if (!feed.handedOn(marker, HANDING_ON) { store.write(stream, listOf(it)) }) {
                val stuck = IllegalStateException("a subscription had not been handed the marker after $HANDING_ON")
                faults.report(Fault("the wipe", "waiting for the feed to hand on what was written before it", stuck))
            }
        } finally {
            store.deleteEventStream(stream)
        }
    }

    override fun close() {
        subscriptions.shutdown()
        dispatcher.shutdownNow()
        client.close()
    }

    private companion object {
        const val EVENTS = "events"

        /** Far longer than any fold takes: a subscription still busy after this is stuck. */
        val HANDING_ON: Duration = Duration.ofSeconds(10)

        /**
         * An event's time kept as the text it was written as, to the nanosecond, as the store in memory keeps it,
         * so it is read as it was written (0074). Kept as a date, Occurrent refuses any time finer than a
         * millisecond outright, and the server's clock is finer than that: every command would be refused.
         */
        val TIME = TimeRepresentation.RFC_3339_STRING
    }
}
