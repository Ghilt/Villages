package villages.application

import villages.domain.Event
import java.time.Instant
import java.util.UUID

/**
 * An event as it was stored: the envelope every event carries, and the domain event inside it. This is
 * the shape the rest of the system sees events in, whichever store they came from.
 */
data class StoredEvent(
    /** The event id: a UUID, unique across the world. What a consumer deduplicates by. */
    val id: String,
    /** `villages.<aggregate>.<verb>.v<n>`, as catalogued in docs/EVENTS.md. */
    val type: String,
    /** The stream it belongs to: `house:<uuid>` for a house's. */
    val stream: String,
    /** Its position in that stream, from one. */
    val streamVersion: Long,
    /** When it was recorded, by the server's clock. The world-time is inside the event. */
    val time: Instant,
    /** The event's data as the store holds it, JSON text. What the debug panel opens. */
    val data: String,
    /** The story this event belongs to. Everything that followed from one command shares it. See 0035. */
    val correlationId: String,
    /** What directly caused it: for an event from a command, that command's id. See 0035. */
    val causationId: String,
    val event: Event,
)

/**
 * Where a subscriber wants a feed to begin.
 *
 * The two callers want opposite things, and the difference matters the moment events outlive the process.
 * A read model folded from the beginning is the whole of its own correctness; a watcher that replayed
 * every event ever stored on each connect would be showing history rather than what is happening.
 */
enum class Start {
    /**
     * Everything the store holds, then everything that follows. What a read model needs: it is rebuilt by
     * replaying, so a projection that only saw what came after it was built would be quietly incomplete.
     */
    FROM_THE_BEGINNING,

    /** Only what is stored from here on. What a watcher of the world happening wants. */
    FROM_NOW,
}

/**
 * Every event, as it is stored, in order. What the gateway fans out and the projections fold.
 *
 * Delivery is at least once: a subscriber that starts from the beginning may see an event twice if it was
 * appended while the replay was running, and folding the same event twice must be harmless. That is the
 * ordinary bargain of reading a log, and it is why events are folded by identity rather than counted.
 */
interface EventFeed {
    /** Delivers events until the returned handle is closed. */
    fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable

    /**
     * Hears of every subscriber that throws on an event, until the returned handle is closed. The feed says
     * so and goes on without handing that event to that subscriber again, so the read model is missing it
     * and this is how anybody finds out. A feed that delivers on the caller's thread, as the tests' fakes
     * do, lets the throw reach the caller instead, so by default there is nothing to hear.
     */
    fun watchFaults(listener: (FeedFault) -> Unit): AutoCloseable = AutoCloseable {}
}

/** A subscriber to the feed that threw on an event: which one, on what, and what it threw. */
data class FeedFault(val subscriber: String, val event: StoredEvent, val thrown: Exception) {
    /** The fault in one line, said the same in the server's log and in the debug panel. */
    fun describe(): String =
        "$subscriber threw on ${event.type} (${event.stream}, version ${event.streamVersion}): " +
            thrown.javaClass.simpleName + (thrown.message?.let { ": $it" } ?: "")
}
