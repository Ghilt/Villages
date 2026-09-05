package villages.protocol

/**
 * The world's calendar: how a count of world-days is read as a year and a day, and spelled.
 *
 * Years are three hundred and sixty-five days, every one of them - a fictional calendar owes nobody a
 * leap day. Day zero is the first day of year one. Both ends of the wire compute this, because the browser
 * shows a year and the server stores a day; `contracts/fixtures/calendar.json` holds the vectors both are
 * held to. Months can come later, if the fiction wants them. See decision record 0027.
 */
object Calendar {
    const val DAYS_PER_YEAR = 365L

    fun yearOf(day: Long): Long = day / DAYS_PER_YEAR + 1

    fun dayOfYearOf(day: Long): Int = (day % DAYS_PER_YEAR).toInt() + 1

    fun dayOf(year: Long, dayOfYear: Int): Long {
        require(year >= 1) { "the world's calendar starts at year 1, not $year" }
        require(dayOfYear in 1..DAYS_PER_YEAR) { "a year has $DAYS_PER_YEAR days, so there is no day $dayOfYear" }
        return (year - 1) * DAYS_PER_YEAR + (dayOfYear - 1)
    }

    /** How a day is written for a person: the year, and the day within it when it is not the first. */
    fun describe(day: Long): String {
        val dayOfYear = dayOfYearOf(day)
        return if (dayOfYear == 1) "year ${yearOf(day)}" else "year ${yearOf(day)}, day $dayOfYear"
    }
}
