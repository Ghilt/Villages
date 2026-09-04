package villages.application

import villages.domain.HouseCommand
import villages.domain.HouseEvent
import villages.domain.PlayerId
import java.time.Instant

/**
 * The ports: what the use cases need from the world outside, as interfaces this module owns and the
 * infrastructure implements from the other side. Nothing here names Occurrent, MongoDB, RabbitMQ or Spring.
 */

/** Runs a command against its house's stream: load, decide, append. Throws a HouseError when refused. */
fun interface HouseCommandExecutor {
    fun execute(command: HouseCommand)
}

/** The server's clock, so that a use case can be tested at a chosen instant. */
fun interface Clock {
    fun now(): Instant
}

/** Who a token belongs to. Anonymous browser tokens for now; accounts replace this without moving anything. */
fun interface PlayerTokens {
    fun playerOf(token: String): PlayerId
}

/**
 * An event as it was stored: the envelope every event carries, and the domain event inside it. This is
 * the shape the rest of the system sees events in, whichever store they came from.
 */
data class StoredEvent(
    /** A UUID, unique across the world. */
    val id: String,
    /** `villages.<aggregate>.<verb>.v<n>`, as catalogued in docs/EVENTS.md. */
    val type: String,
    /** The stream it belongs to, `house:<uuid>`. */
    val stream: String,
    /** Its position in that stream, from one. */
    val streamVersion: Long,
    /** When it happened, by the server's clock. */
    val time: Instant,
    /** The event's data as the store holds it, JSON text. What the debug panel opens. */
    val data: String,
    val event: HouseEvent,
)

/** Every event, as it is stored, in order. What the gateway fans out and the projections fold. */
fun interface EventFeed {
    /** Delivers every event stored from now on, until the returned handle is closed. */
    fun subscribe(subscriber: (StoredEvent) -> Unit): AutoCloseable
}
