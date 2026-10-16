package villages.bots

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicInteger

/** The three round trips a bot times: arriving, being answered, and being shown a cell. */
enum class Trip { WELCOME, ACCEPTED, SNAPSHOT }

/**
 * Every round trip a swarm's bots made, and every way they failed, kept until somebody reads them. Shared by all the
 * bots of a run, each started by one key and finished by the same one: the player's token for a welcome, the command's
 * id for an answer, the cell for a snapshot (with the bot's token, since two bots may ask for one cell at once).
 */
class RoundTrips {
    private val open = ConcurrentHashMap<Pair<Trip, String>, Long>()
    private val took = Trip.entries.associateWith { ConcurrentLinkedQueue<Long>() }
    private val failures = ConcurrentLinkedQueue<String>()
    private val failed = AtomicInteger()

    fun started(trip: Trip, key: String, at: Long) {
        open[trip to key] = at
    }

    /** A trip finished that nobody started, a snapshot sent again on a resync, is not one of ours and is not counted. */
    fun finished(trip: Trip, key: String, at: Long) {
        val from = open.remove(trip to key) ?: return
        took.getValue(trip) += at - from
    }

    fun failure(why: String) {
        failed.incrementAndGet()
        failures += why
    }

    /** What was measured since the last time it was asked, and forgotten, so a run can read it stage by stage. */
    fun drain(): Measured {
        val each = Trip.entries.associateWith { trip -> generateSequence { took.getValue(trip).poll() }.toList().sorted() }
        val why = generateSequence { failures.poll() }.groupingBy { it }.eachCount()
        return Measured(each, failed.getAndSet(0), why)
    }

    /** Trips started longer ago than `limit` and never finished: each is a failure, and is let go. */
    fun overdue(now: Long, limit: Long): Int {
        val late = open.entries.filter { now - it.value > limit }
        late.forEach { open.remove(it.key); failure("no ${it.key.first.name.lowercase()} within $limit ms") }
        return late.size
    }
}

/** Round trips in milliseconds, sorted, a trip each, and the failures with how often each was given as the reason. */
data class Measured(val took: Map<Trip, List<Long>>, val failed: Int, val reasons: Map<String, Int>) {
    fun percentile(trip: Trip, fraction: Double): Long? {
        val all = took.getValue(trip)
        if (all.isEmpty()) return null
        return all[((all.size - 1) * fraction).toInt()]
    }
}
