package villages.domain

import java.time.Duration
import java.time.Instant
import kotlin.math.floor

/**
 * The stored wealth of a house, expressed as a rate: an amount, a rate per second, and the instant at
 * which that was true. The server says this once and again only when it changes; between times, anyone
 * holding it can work out the amount now. That is what lets the world have no tick events.
 */
data class Treasury(val amount: Long, val ratePerSecond: Double, val asOf: Instant) {
    init {
        require(amount >= 0) { "a treasury does not go below nothing: $amount" }
        require(ratePerSecond.isFinite()) { "a rate is a number: $ratePerSecond" }
    }

    /** The amount at a later instant, the rate having run on. Before `asOf` it is what it was. */
    fun at(now: Instant): Long {
        val elapsed = Duration.between(asOf, now)
        if (elapsed.isNegative) return amount
        val seconds = elapsed.toNanos() / 1_000_000_000.0
        return amount + floor(ratePerSecond * seconds).toLong()
    }
}
