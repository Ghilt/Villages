package villages.application

import villages.domain.WorldTime
import java.time.Instant

/**
 * One world-month for every real day since the world opened, the same for everyone.
 *
 * A browser game is played in short visits, and a month a visit is what lets a house's history move while
 * the player lives their life; a world that ran at a day a day would take a lifetime to reach anything. The
 * world is shared, so the speed is not anybody's to change - there is no fast-forward in a game other people
 * are standing in. The placeholder for the chrono-engine's shared world-day. Pure, so it is a policy and not
 * infrastructure, and a test can stand at any real instant. See decision record 0053.
 */
class MonthlyWorldClock(
    private val clock: Clock,
    private val calendar: WorldCalendar,
    /** The real instant the world opened. */
    private val opened: Instant,
    /** The world-day it was on when it opened. */
    private val openingDay: WorldTime,
) : WorldClock, WorldSchedule {
    override fun today(): WorldTime {
        val realDays = java.time.Duration.between(opened, clock.now()).toDays()
        return calendar.plusMonths(openingDay, realDays.coerceAtLeast(0))
    }

    /**
     * Read backwards: a month of the world's is a real day, so the world reaches a day as many real days
     * after it opened as there are whole months between.
     *
     * Exact as long as the world opens on the first of a month, because then every day it produces is the
     * first of a month and no day-of-month is ever clamped. See the note on `Calendar.monthsBetween`.
     */
    override fun whenIsDay(day: WorldTime): Instant =
        opened.plus(java.time.Duration.ofDays(calendar.monthsBetween(openingDay, day).coerceAtLeast(0)))
}
