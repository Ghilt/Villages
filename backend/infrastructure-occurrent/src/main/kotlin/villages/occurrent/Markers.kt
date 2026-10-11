package villages.occurrent

import io.cloudevents.CloudEvent
import io.cloudevents.core.builder.CloudEventBuilder
import java.time.Duration
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * The type of a marker: an event written into the store only to learn when every subscription has been handed
 * everything written before it. Never handed to a subscriber, never folded, and gone with the wipe that wrote it.
 */
internal const val MARKER = "villages.feed.marker"

/** A new marker, to be written on a stream of its own and deleted once every subscription has reached it. */
internal fun aMarker(): CloudEvent = CloudEventBuilder.v1()
    .withId(UUID.randomUUID().toString())
    .withSource(Events.SOURCE)
    .withType(MARKER)
    .withTime(OffsetDateTime.now(ZoneOffset.UTC))
    .build()

/**
 * Which subscriptions of a feed have yet to reach each marker written, so that a wipe can wait for all of them.
 *
 * A store hands each subscription its events one at a time and in the order they were written, so a subscription
 * that has reached a marker has handed on everything written before it. That is what a wipe waits for in MongoDB,
 * whose change streams have nothing like the in-memory model's own wait. See decision record 0036.
 */
internal class Markers {
    private val lock = ReentrantLock()
    private val changed = lock.newCondition()
    private val live = HashSet<String>()
    private val waiting = HashMap<String, MutableSet<String>>()

    fun joined(subscription: String) = lock.withLock { live += subscription }

    /** A subscription closed: it is waited for by nothing any more. */
    fun gone(subscription: String) = lock.withLock {
        live -= subscription
        waiting.values.forEach { it -= subscription }
        changed.signalAll()
    }

    fun reached(subscription: String, marker: String) = lock.withLock {
        waiting[marker]?.remove(subscription)
        changed.signalAll()
    }

    /** Every subscription live now has to reach [marker] before [awaitAll] says so. Called before it is written. */
    fun expect(marker: String) = lock.withLock { waiting[marker] = live.toMutableSet() }

    /** Whether every subscription expected reached [marker] within [timeout]. */
    fun awaitAll(marker: String, timeout: Duration): Boolean = lock.withLock {
        var left = timeout.toNanos()
        while (waiting[marker].orEmpty().isNotEmpty()) {
            if (left <= 0) {
                waiting.remove(marker)
                return false
            }
            left = changed.awaitNanos(left)
        }
        waiting.remove(marker)
        true
    }
}
