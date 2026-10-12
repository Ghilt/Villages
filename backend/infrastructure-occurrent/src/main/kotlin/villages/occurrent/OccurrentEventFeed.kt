package villages.occurrent

import io.cloudevents.CloudEvent
import org.occurrent.application.converter.CloudEventConverter
import org.occurrent.eventstore.api.SortBy
import org.occurrent.eventstore.api.blocking.EventStoreQueries
import villages.application.EventFeed
import villages.application.Fault
import villages.application.Faults
import villages.application.NamedSubscriber
import villages.application.Start
import villages.application.StoredEvent
import villages.application.WipeGate
import villages.domain.Event
import java.util.UUID

/**
 * The event feed port: a live half, [Live], and the history, which is always read from the store. Whichever store
 * is underneath, in memory or in MongoDB, and whichever live half, the store's own subscriptions or the broker
 * (decision record 0094), this is the same code.
 *
 * Starting from the beginning is the careful part, and the order matters: **subscribe first, then replay**.
 * Replaying first and subscribing afterwards leaves a window in which an event appended between the two is
 * seen by neither, and a read model missing one event is wrong for ever. Done this way the window costs a
 * duplicate instead, which the subscriber can drop by identity - and at-least-once is the guarantee a log
 * reader is supposed to have. The hand-over from the history to what arrives live is `Handoff`, under one lock,
 * so that nothing is lost in between and a subscriber is never handed two events at once. See decision 0029.
 *
 * Subscribing, and reading the history, are outside a wipe, [WipeGate]: a replay holds what arrives live until it
 * is done, and a wipe that came in the middle would forget the world before the replay had handed it on. The
 * wipe's [Markers] are the world's rather than the feed's, so that a wipe waits for every feed over the world.
 */
class OccurrentEventFeed internal constructor(
    private val live: Live,
    private val store: EventStoreQueries,
    private val converter: CloudEventConverter<Event>,
    private val faults: Faults,
    private val gate: WipeGate,
    private val markers: Markers,
) : EventFeed {
    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        // Named for whom it follows, so that a queue on the broker's page says whose it is.
        val id = "${nameOf(subscriber)}.${UUID.randomUUID().toString().take(8)}"
        // Touched only under the hand-off's lock.
        val alreadySeen = HashSet<String>()

        fun hand(cloudEvent: CloudEvent) {
            // A marker is the feed's own. Handed this far, everything written before it has been handed on, which is
            // what a wipe waits for; never the subscriber's, and one a wipe left behind by dying half way is not the
            // world's history.
            if (cloudEvent.type == MARKER) {
                markers.reached(id, cloudEvent.id)
                return
            }
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

        fun replay() {
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

        val listener = object : Listener {
            override fun arrived(event: CloudEvent) = handoff.live(event)

            // The same as subscribing, again: listen first, then the history, which holds what was missed. A feed that
            // starts from now has no history to read, and what it missed it misses.
            override fun missed(listenAgain: () -> Unit) = gate.outside {
                if (from == Start.FROM_THE_BEGINNING) handoff.rearm()
                listenAgain()
                if (from == Start.FROM_THE_BEGINNING) replay()
            }
        }

        val listening = gate.outside {
            markers.joined(id)
            val listening = live.listen(id, listener)
            if (from == Start.FROM_THE_BEGINNING) replay()
            listening
        }

        return AutoCloseable {
            listening.close()
            markers.gone(id)
        }
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
