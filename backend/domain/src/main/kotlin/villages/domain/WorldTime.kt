package villages.domain

/**
 * A moment in the world's own calendar: the story's clock, as opposed to the clock on the wall.
 *
 * Counted in days from the first day of the world's first year, so that two moments compare as numbers
 * and a span is a subtraction. The domain needs nothing more of it than that. What day of what year a
 * count is, and how it is spelled, is the calendar in `villages.protocol.Calendar`, which both ends of the
 * wire compute alike. See decision record 0027.
 */
@JvmInline
value class WorldTime(val day: Long) : Comparable<WorldTime> {
    init {
        require(day >= 0) { "the world's calendar starts at day 0, not $day" }
    }

    override fun compareTo(other: WorldTime): Int = day.compareTo(other.day)

    operator fun plus(days: Long): WorldTime = WorldTime(day + days)

    operator fun minus(days: Long): WorldTime = WorldTime(day - days)
}
