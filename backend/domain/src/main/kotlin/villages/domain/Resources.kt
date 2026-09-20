package villages.domain

import java.time.Duration
import java.time.Instant
import kotlin.math.floor

/**
 * What a house has, and one shape for all of it.
 *
 * The five behave differently in the fiction - wealth is spent, domain and influence gate what a house
 * may attempt, reason and piety are pledged away for a span and come back - but they are one kind of
 * thing underneath: an amount that can grow, part of which may be spoken for. Making that one type is
 * what lets a resource change its behaviour later without changing its shape, and what stops the world
 * growing three near-identical value objects. See `SETTING.md` for what each of them means.
 */
enum class Resource {
    /** Gold and treasure. The one that is spent: spending lowers it. */
    WEALTH,

    /**
     * Reach over land and what it yields. A gate: a house needs enough, and needing it does not use it.
     *
     * **The player calls this Domain.** It is qualified here because `domain` already names the innermost
     * layer of the server, and one word for two things is a word nobody can grep for. See the naming rule
     * in `BUILDING-A-MECHANIC.md`; `GLOSSARY.md` records both names.
     */
    NATURAL_DOMAIN,

    /** Reach over people and politics. A gate, exactly as domain is. */
    INFLUENCE,

    /** What a house can think with. Pledged away to an undertaking for a span of months, then back. */
    REASON,

    /** Observance, and what a house owes and is owed for it. Pledged, exactly as reason is. */
    PIETY,
}

/**
 * How much of one resource a house has: an amount, a rate per second, and the instant that was true.
 *
 * The server says this once and again only when it changes; between times, anyone holding it can work
 * out the amount now. That is what lets the world have no tick events. See decision record 0006.
 *
 * **What is pledged is not here**, because it is not stored anywhere: it is the sum of the house's live
 * pledges against this resource, and a stock that carried its own copy would be a second place for one
 * fact to be wrong in. A stock knows how much there is; the house knows how much of it is spoken for.
 */
data class Stock(val total: Long, val ratePerSecond: Double, val asOf: Instant) {
    init {
        require(total >= 0) { "a stock does not go below nothing: $total" }
        require(ratePerSecond.isFinite()) { "a rate is a number: $ratePerSecond" }
    }

    /** The total at a later instant, the rate having run on. Before `asOf` it is what it was. */
    fun at(now: Instant): Long {
        val elapsed = Duration.between(asOf, now)
        if (elapsed.isNegative) return total
        val seconds = elapsed.toNanos() / 1_000_000_000.0
        return total + floor(ratePerSecond * seconds).toLong()
    }
}

/**
 * One stock of each resource, empty and standing still: what a house is founded with.
 *
 * Every rate is zero because nothing in the world generates income yet. The rate is carried all the same
 * so that when something does, it is a number changing rather than a shape changing. See decision 0006.
 */
fun emptyStocks(asOf: Instant): Map<Resource, Stock> =
    Resource.entries.associateWith { Stock(total = 0, ratePerSecond = 0.0, asOf = asOf) }
