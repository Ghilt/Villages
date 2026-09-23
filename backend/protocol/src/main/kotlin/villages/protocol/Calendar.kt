package villages.protocol

import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * The world's calendar: how a count of world-days is read as a date, and spelled.
 *
 * It is Earth's calendar - the proleptic Gregorian one, leap years and uneven months and all - because the
 * world is a warped Earth and its months are Earth's months. Day zero is the first of January, year one.
 * Both ends of the wire compute this, because the browser shows a date and the server stores a day;
 * `contracts/fixtures/calendar.json` holds the vectors both are held to.
 *
 * This side leans on `java.time.LocalDate`, which is the same proleptic Gregorian calendar the browser
 * works out by hand, because the browser's `Date` cannot be trusted with year one. Two roads to one
 * calendar, and the fixture is what keeps them honest.
 *
 * A real day is a world month. See decision record 0051.
 */
object Calendar {

    /** Day zero is the first of January, year one, which is this many days before the Unix epoch. */
    private const val BEFORE_EPOCH = 719_162L

    val MONTHS =
        listOf(
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        )

    /** Spelled out, because a date is read aloud as words and not as a number with a suffix stuck on it. */
    private val ORDINALS =
        listOf(
            "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
            "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth",
            "eighteenth", "nineteenth", "twentieth", "twenty-first", "twenty-second", "twenty-third",
            "twenty-fourth", "twenty-fifth", "twenty-sixth", "twenty-seventh", "twenty-eighth",
            "twenty-ninth", "thirtieth", "thirty-first",
        )

    fun dateOf(day: Long): LocalDate = LocalDate.ofEpochDay(day - BEFORE_EPOCH)

    /** The world-day a date falls on. The inverse of `dateOf`, and it refuses a date the calendar has not got. */
    fun dayOf(year: Long, month: Int, dayOfMonth: Int): Long {
        require(year >= 1) { "the world's calendar starts at year 1, not $year" }
        require(month in 1..12) { "a year has twelve months, so there is no month $month" }
        val held = LocalDate.of(year.toInt(), month, 1).lengthOfMonth()
        require(dayOfMonth in 1..held) {
            "${MONTHS[month - 1]} of year $year has $held days, so there is no day $dayOfMonth"
        }
        return LocalDate.of(year.toInt(), month, dayOfMonth).toEpochDay() + BEFORE_EPOCH
    }

    fun yearOf(day: Long): Long = dateOf(day).year.toLong()

    fun monthOf(day: Long): Int = dateOf(day).monthValue

    fun dayOfMonthOf(day: Long): Int = dateOf(day).dayOfMonth

    /**
     * The world-day a number of months later, which is how every span in the world is measured.
     *
     * The day of the month is held where it can be and pulled back where it cannot, so the thirty-first of
     * January and one month is the twenty-eighth of February rather than the third of March. A pledge made
     * on the last day of a long month ends on the last day of a short one, which is what a person would
     * expect, and `LocalDate` already does it.
     */
    fun plusMonths(day: Long, months: Long): Long = dateOf(day).plusMonths(months).toEpochDay() + BEFORE_EPOCH

    /**
     * Whole months from one day to another, counting only the ones completed.
     *
     * **Not the exact inverse of `plusMonths`.** A month added to the thirty-first of January is pulled
     * back to the twenty-eighth of February, and the twenty-eighth of February is not a whole month after
     * the thirty-first of January, so the pair does not round-trip through a clamped day. It never bites
     * in practice, because the world opens on the first of a month and only ever advances whole months,
     * so every world-day it produces is the first of a month. It would bite the day somebody opens the
     * world on the thirty-first. The shared fixture pins both halves, including that case.
     */
    fun monthsBetween(from: Long, to: Long): Long = ChronoUnit.MONTHS.between(dateOf(from), dateOf(to))

    /** How a day is written for a person: the day, its month, and the year it falls in. */
    fun describe(day: Long): String {
        val date = dateOf(day)
        return "the ${ORDINALS[date.dayOfMonth - 1]} of ${MONTHS[date.monthValue - 1]}, year ${date.year}"
    }
}
