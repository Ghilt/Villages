package villages.occurrent

import io.cloudevents.CloudEvent
import org.occurrent.application.converter.CloudEventConverter
import org.occurrent.eventstore.api.SortBy
import org.occurrent.eventstore.api.blocking.EventStoreQueries
import org.occurrent.eventstore.inmemory.InMemoryEventStore
import org.occurrent.retry.RetryStrategy
import org.occurrent.subscription.StartAt
import org.occurrent.subscription.SubscriptionFilter
import org.occurrent.subscription.api.blocking.Subscription
import org.occurrent.subscription.api.blocking.SubscriptionModel
import org.occurrent.subscription.inmemory.InMemorySubscription
import org.occurrent.subscription.inmemory.InMemorySubscriptionModel
import villages.application.CharacterCommandExecutor
import villages.application.EventFeed
import villages.application.Fault
import villages.application.FaultBoard
import villages.application.Faults
import villages.application.HouseCommandExecutor
import villages.application.Start
import villages.application.StoredEvent
import villages.domain.Event
import java.lang.reflect.Method
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.function.Consumer

/**
 * The event feed port over an Occurrent subscription. Whichever store is underneath, in memory today and
 * MongoDB from increment 0.8, this is the same code, because a subscription model is the same interface
 * over both.
 *
 * Starting from the beginning is the careful part, and the order matters: **subscribe first, then replay**.
 * Replaying first and subscribing afterwards leaves a window in which an event appended between the two is
 * seen by neither, and a read model missing one event is wrong for ever. Done this way the window costs a
 * duplicate instead, which the subscriber can drop by identity - and at-least-once is the guarantee a log
 * reader is supposed to have. The hand-over from the history to what arrives live is `Handoff`, under one lock,
 * so that nothing is lost in between and a subscriber is never handed two events at once. See decision 0029.
 */
class OccurrentEventFeed(
    private val subscriptions: SubscriptionModel,
    private val store: EventStoreQueries,
    private val converter: CloudEventConverter<Event>,
    private val faults: Faults,
) : EventFeed {

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        val id = "feed-${UUID.randomUUID()}"
        // Touched only under the hand-off's lock.
        val alreadySeen = HashSet<String>()

        fun hand(cloudEvent: CloudEvent) {
            if (!alreadySeen.add(cloudEvent.id)) {
                return
            }
            // Thrown on to Occurrent, either throw below would be retried, and the retry dropped above as already
            // seen: lost without a word. Said instead, once, and the feed goes on to the next event.
            val stored = try {
                cloudEvent.toStored(converter)
            } catch (@Suppress("TooGenericExceptionCaught") unreadable: Exception) {
                faults.report(Fault(nameOf(subscriber), "${cloudEvent.type} ${cloudEvent.id}, which could not be read", unreadable))
                return
            }
            try {
                subscriber(stored)
            } catch (@Suppress("TooGenericExceptionCaught") thrown: Exception) {
                faults.report(Fault.onEvent(nameOf(subscriber), stored, thrown))
            }
        }

        val handoff = Handoff(replaying = from == Start.FROM_THE_BEGINNING, ::hand)
        val subscription = subscriptions.subscribe(id, null, StartAt.now()) { cloudEvent -> handoff.live(cloudEvent) }
        subscription.waitUntilStarted()

        if (from == Start.FROM_THE_BEGINNING) {
            store.all(SortBy.natural(SortBy.SortDirection.ASCENDING)).use { everything ->
                everything.forEach(handoff::replayed)
            }
            // Anything that arrived while the replay ran, in the order it arrived, minus what it duplicated.
            handoff.replayDone()
        }

        return AutoCloseable { subscriptions.cancelSubscription(id) }
    }
}

/** Who a subscriber is, for saying so: a Kotlin lambda's class is named after the class it was written in. */
private fun nameOf(subscriber: Any): String = subscriber.javaClass.name.substringAfterLast('.').substringBefore('$')

/** Occurrent's extension attributes, by the names it writes them under. */
private const val STREAM_ID = "streamid"
private const val STREAM_VERSION = "streamversion"

internal fun CloudEvent.toStored(converter: CloudEventConverter<Event>): StoredEvent = StoredEvent(
    id = id,
    type = type,
    stream = getExtension(STREAM_ID).toString(),
    streamVersion = (getExtension(STREAM_VERSION) as Number).toLong(),
    time = time!!.toInstant(),
    data = String(data!!.toBytes()),
    // An event with no provenance on it is its own story, which is what a first message's correlation
    // means anyway. Nothing this code writes lacks one; an older event might. See decision record 0035.
    correlationId = getExtension(Events.CORRELATION_ID)?.toString() ?: id,
    causationId = getExtension(Events.CAUSATION_ID)?.toString() ?: id,
    event = converter.toDomainEvent(this),
)

/**
 * A whole world in memory: store, subscriptions, and the ports over them, one executor for each kind of stream.
 * Nothing survives a restart, on purpose, until MongoDB exists. Used by the app when there is no database
 * and by every test that wants the real machinery without one.
 */
/** The world in memory. Whatever acts on it and throws is said on `faults`, which the server's log and the gateway watch. */
class InMemoryWorld(val faults: Faults = FaultBoard()) : AutoCloseable {
    /**
     * The threads the subscriptions run on. A stopped subscription notices only when its half-second poll comes
     * back, and the model's shutdown waits for that, so shutting this down wakes them rather than waiting.
     */
    internal val dispatcher: ExecutorService = object : ExecutorService by Executors.newCachedThreadPool() {
        override fun shutdown() {
            shutdownNow()
        }
    }

    // Occurrent's own defaults, but for the dispatcher.
    private val subscriptions = InMemorySubscriptionModel(dispatcher, RetryStrategy.fixed(200))
    val store = InMemoryEventStore(subscriptions)
    val converter = Events.converter()

    val executor: HouseCommandExecutor = OccurrentHouseCommandExecutor(store, converter)
    val characterExecutor: CharacterCommandExecutor = OccurrentCharacterCommandExecutor(store, converter)
    val feed: EventFeed = OccurrentEventFeed(StopOnCancel(subscriptions), store, converter, faults)

    /**
     * Empties the store, stream by stream, and says how many events went.
     *
     * Stream by stream rather than by one filter because the count is the point: a line saying "emptied
     * the world, 37 events" is a line a reader can believe. See decision record 0036.
     */
    fun wipe(): Int {
        val streams = store.all(SortBy.natural(SortBy.SortDirection.ASCENDING)).use { everything ->
            everything.map { it.getExtension(STREAM_ID).toString() }.toList()
        }
        streams.distinct().forEach(store::deleteEventStream)
        return streams.size
    }

    override fun close() {
        subscriptions.shutdown()
    }
}

/**
 * Occurrent 0.33.0's in-memory model cancels a subscription by forgetting it, and leaves its thread polling for
 * as long as the process runs; shutting the model down then waits five seconds for that thread and gives up.
 * Occurrent's master stops the subscription on cancel, and no release has it yet. Until one does, this does
 * what that fix does, through the package-private method the model's own shutdown calls.
 */
private class StopOnCancel(private val model: InMemorySubscriptionModel) : SubscriptionModel by model {
    private val subscribed = ConcurrentHashMap<String, Subscription>()

    override fun subscribe(
        subscriptionId: String,
        filter: SubscriptionFilter?,
        startAt: StartAt,
        action: Consumer<CloudEvent>,
    ): Subscription = model.subscribe(subscriptionId, filter, startAt, action).also { subscribed[subscriptionId] = it }

    override fun cancelSubscription(subscriptionId: String) {
        model.cancelSubscription(subscriptionId)
        subscribed.remove(subscriptionId)?.let { stop.invoke(it) }
    }

    private companion object {
        val stop: Method = InMemorySubscription::class.java.getDeclaredMethod("shutdown").apply { isAccessible = true }
    }
}
