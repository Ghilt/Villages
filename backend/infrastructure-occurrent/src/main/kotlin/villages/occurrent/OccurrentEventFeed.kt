package villages.occurrent

import io.cloudevents.CloudEvent
import org.occurrent.application.converter.CloudEventConverter
import org.occurrent.eventstore.api.SortBy
import org.occurrent.eventstore.api.blocking.EventStoreQueries
import org.occurrent.subscription.StartAt
import org.occurrent.subscription.api.blocking.SubscriptionModel
import villages.application.EventFeed
import villages.application.Fault
import villages.application.Faults
import villages.application.NamedSubscriber
import villages.application.Start
import villages.application.StoredEvent
import villages.application.WipeGate
import villages.domain.Event
import java.time.Duration
import java.util.UUID

/**
 * The event feed port over an Occurrent subscription. Whichever store is underneath, in memory or in MongoDB,
 * this is the same code, because a subscription model is the same interface over both.
 *
 * Starting from the beginning is the careful part, and the order matters: **subscribe first, then replay**.
 * Replaying first and subscribing afterwards leaves a window in which an event appended between the two is
 * seen by neither, and a read model missing one event is wrong for ever. Done this way the window costs a
 * duplicate instead, which the subscriber can drop by identity - and at-least-once is the guarantee a log
 * reader is supposed to have. The hand-over from the history to what arrives live is `Handoff`, under one lock,
 * so that nothing is lost in between and a subscriber is never handed two events at once. See decision 0029.
 *
 * Subscribing, and reading the history, are outside a wipe, [WipeGate]: a replay holds what arrives live until it
 * is done, and a wipe that came in the middle would forget the world before the replay had handed it on.
 */
class OccurrentEventFeed(
    private val subscriptions: SubscriptionModel,
    private val store: EventStoreQueries,
    private val converter: CloudEventConverter<Event>,
    private val faults: Faults,
    private val gate: WipeGate,
) : EventFeed {
    private val markers = Markers()

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        val id = "feed-${UUID.randomUUID()}"
        // Touched only under the hand-off's lock.
        val alreadySeen = HashSet<String>()

        fun hand(cloudEvent: CloudEvent) {
            // A marker is the feed's own, and one a wipe left behind by dying half way is not the world's history.
            if (cloudEvent.type == MARKER || !alreadySeen.add(cloudEvent.id)) {
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
        gate.outside {
            markers.joined(id)
            val subscription = subscriptions.subscribe(id, null, StartAt.now()) { cloudEvent ->
                if (cloudEvent.type == MARKER) markers.reached(id, cloudEvent.id) else handoff.live(cloudEvent)
            }
            subscription.waitUntilStarted()

            if (from == Start.FROM_THE_BEGINNING) {
                try {
                    store.all(SortBy.natural(SortBy.SortDirection.ASCENDING)).use { everything ->
                        everything.forEach(handoff::replayed)
                    }
                } catch (@Suppress("TooGenericExceptionCaught") broken: Exception) {
                    // The store could not hand the history back past an event. Said, and the subscriber goes on
                    // with what arrives live: a server that cannot start is a world that cannot be wiped.
                    val where = "reading the history, which stopped at an event the store could not read back"
                    faults.report(Fault(nameOf(subscriber), where, broken))
                }
                // Anything that arrived while the replay ran, in the order it arrived, minus what it duplicated.
                handoff.replayDone()
            }
        }

        return AutoCloseable {
            subscriptions.cancelSubscription(id)
            markers.gone(id)
        }
    }

    /**
     * Waits until every subscription has been handed everything written before [marker], which [write] puts in the
     * store, and says whether they all got there within [timeout]. For a wipe, inside its gate, on a store whose
     * subscriptions have nothing like the in-memory model's own wait: see `Markers`.
     */
    internal fun handedOn(marker: CloudEvent, timeout: Duration, write: (CloudEvent) -> Unit): Boolean {
        markers.expect(marker.id)
        write(marker)
        return markers.awaitAll(marker.id, timeout)
    }
}

/**
 * Who a subscriber is, for saying so: its own name when it has one, and otherwise its class, which for a Kotlin
 * lambda is named after the class it was written in.
 */
private fun nameOf(subscriber: Any): String =
    (subscriber as? NamedSubscriber)?.name ?: subscriber.javaClass.name.substringAfterLast('.').substringBefore('$')

/** Occurrent's extension attributes, by the names it writes them under. */
internal const val STREAM_ID = "streamid"
internal const val STREAM_VERSION = "streamversion"

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
