package villages.application

import villages.domain.WorldTime
import java.time.Instant

/** The server's clock, so that a use case can be tested at a chosen instant. */
fun interface Clock {
    fun now(): Instant
}

/**
 * What day it is in the world: the world-time a thing done now is recorded as having happened at. A world
 * month for every real day since the world opened, the same for everyone and nobody's to change. See
 * decision record 0053.
 */
fun interface WorldClock {
    fun today(): WorldTime
}

/**
 * The world's calendar, as much of it as a use case needs: how to step a world-day on by months, or back by
 * them with a negative number.
 *
 * The arithmetic is `villages.protocol.Calendar`, which both ends of the wire compute alike and which this
 * layer may not see, because the application layer depends on the domain and on nothing else. So it crosses
 * as a port like everything else does. See decision record 0053.
 */
interface WorldCalendar {
    fun plusMonths(day: WorldTime, months: Long): WorldTime

    /** Whole months from one day to another, counting only the completed ones. */
    fun monthsBetween(from: WorldTime, to: WorldTime): Long
}

/**
 * When the world will reach a day, by the clock on the wall.
 *
 * The inverse of the world clock, and what anything waiting for a world-day needs: a pledge that comes
 * back in ten months has to be woken at some real instant, and only the clock knows which. Separate from
 * `WorldClock` so that that one stays a single method a test can hand over as a lambda.
 */
fun interface WorldSchedule {
    fun whenIsDay(day: WorldTime): Instant
}

/**
 * Something to be done later, once: a delay and an action.
 *
 * Owned here because two things need it and neither owns the other - the gateway coalesces its deltas
 * with it, and a pledge waits out its span with it. There is no cancelling: whatever is scheduled runs,
 * and a caller whose reason for running has gone away is expected to find that out and do nothing.
 */
fun interface Later {
    fun schedule(delayMs: Long, action: Runnable)
}
