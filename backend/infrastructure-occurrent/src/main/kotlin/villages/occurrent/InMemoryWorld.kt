package villages.occurrent

import io.cloudevents.CloudEvent
import org.occurrent.application.converter.CloudEventConverter
import org.occurrent.eventstore.api.SortBy
import org.occurrent.eventstore.api.blocking.EventStoreQueries
import org.occurrent.eventstore.inmemory.InMemoryEventStore
import org.occurrent.subscription.StartAt
import org.occurrent.subscription.api.blocking.SubscriptionModel
import org.occurrent.subscription.inmemory.InMemorySubscriptionModel
import villages.application.EventFeed
import villages.application.HouseCommandExecutor
import villages.application.Start
import villages.application.StoredEvent
import villages.domain.HouseEvent
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The event feed port over an Occurrent subscription. Whichever store is underneath, in memory today and
 * MongoDB from increment 0.8, this is the same code, because a subscription model is the same interface
 * over both.
 *
 * Starting from the beginning is the careful part, and the order matters: **subscribe first, then replay**.
 * Replaying first and subscribing afterwards leaves a window in which an event appended between the two is
 * seen by neither, and a read model missing one event is wrong for ever. Done this way the window costs a
 * duplicate instead, which the subscriber can drop by identity - and at-least-once is the guarantee a log
 * reader is supposed to have. See decision record 0029.
 */
class OccurrentEventFeed(
    private val subscriptions: SubscriptionModel,
    private val store: EventStoreQueries,
    private val converter: CloudEventConverter<HouseEvent>,
) : EventFeed {
    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        val id = "feed-${UUID.randomUUID()}"
        val alreadySeen = ConcurrentHashMap.newKeySet<String>()
        val waiting = ConcurrentLinkedQueue<CloudEvent>()

        /** True while the replay is running, so what arrives live waits its turn behind history. */
        val replaying = AtomicBoolean(from == Start.FROM_THE_BEGINNING)

        fun hand(cloudEvent: CloudEvent) {
            if (alreadySeen.add(cloudEvent.id)) {
                subscriber(cloudEvent.toStored(converter))
            }
        }

        val subscription = subscriptions.subscribe(id, null, StartAt.now()) { cloudEvent ->
            if (replaying.get()) waiting.add(cloudEvent) else hand(cloudEvent)
        }
        subscription.waitUntilStarted()

        if (from == Start.FROM_THE_BEGINNING) {
            store.all(SortBy.natural(SortBy.SortDirection.ASCENDING)).use { everything ->
                everything.forEach(::hand)
            }
            replaying.set(false)
            // Anything that arrived while the replay ran, in the order it arrived, minus what it duplicated.
            generateSequence { waiting.poll() }.forEach(::hand)
        }

        return AutoCloseable { subscriptions.cancelSubscription(id) }
    }
}

/** Occurrent's extension attributes, by the names it writes them under. */
private const val STREAM_ID = "streamid"
private const val STREAM_VERSION = "streamversion"

internal fun CloudEvent.toStored(converter: CloudEventConverter<HouseEvent>): StoredEvent = StoredEvent(
    id = id,
    type = type,
    stream = getExtension(STREAM_ID).toString(),
    streamVersion = (getExtension(STREAM_VERSION) as Number).toLong(),
    time = time!!.toInstant(),
    data = String(data!!.toBytes()),
    // An event with no provenance on it is its own story, which is what a first message's correlation
    // means anyway. Nothing this code writes lacks one; an older event might. See decision record 0035.
    correlationId = getExtension(HouseEvents.CORRELATION_ID)?.toString() ?: id,
    causationId = getExtension(HouseEvents.CAUSATION_ID)?.toString() ?: id,
    event = converter.toDomainEvent(this),
)

/**
 * A whole world in memory: store, subscriptions, application service, and the two ports over them.
 * Nothing survives a restart, on purpose, until MongoDB exists. Used by the app when there is no database
 * and by every test that wants the real machinery without one.
 */
class InMemoryWorld : AutoCloseable {
    private val subscriptions = InMemorySubscriptionModel()
    val store = InMemoryEventStore(subscriptions)
    val converter = HouseEvents.converter()

    val executor: HouseCommandExecutor = OccurrentHouseCommandExecutor(store, converter)
    val feed: EventFeed = OccurrentEventFeed(subscriptions, store, converter)

    override fun close() {
        subscriptions.shutdown()
    }
}
