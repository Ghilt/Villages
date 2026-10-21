package villages.accounts

import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

/**
 * How many times something may be tried in a while before it is refused: a password guessed for one email, or from
 * one address. Counted in this process's memory, which is enough while there is one game server, and forgotten when
 * it restarts. See docs/plans/accounts.md.
 */
class Attempts(private val clock: Clock, private val most: Int, private val within: Duration) {
    private val tried = ConcurrentHashMap<String, ArrayDeque<Instant>>()

    /** Whether [key] may be tried now. */
    fun allowed(key: String): Boolean = recent(key) < most

    /** A try of [key] that failed. */
    fun failed(key: String) {
        val now = clock.instant()
        tried.compute(key) { _, was -> (was ?: ArrayDeque()).also { it.addLast(now) }.also { drop(it, now) } }
    }

    /** [key] got in, so what it tried before is forgotten. */
    fun forget(key: String) {
        tried.remove(key)
    }

    private fun recent(key: String): Int {
        val now = clock.instant()
        return tried.computeIfPresent(key) { _, was -> was.also { drop(it, now) }.takeIf { it.isNotEmpty() } }?.size ?: 0
    }

    private fun drop(tries: ArrayDeque<Instant>, now: Instant) {
        while (tries.isNotEmpty() && !tries.first().plus(within).isAfter(now)) tries.removeFirst()
    }
}
