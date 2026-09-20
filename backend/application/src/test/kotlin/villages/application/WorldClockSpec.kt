package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.WorldTime
import java.time.Instant

/**
 * The world's clock steps a month for every real day. The calendar itself is the protocol module's and is
 * held to `contracts/fixtures/calendar.json`; what is checked here is the stepping, so the fake below counts
 * a month as thirty days and nothing depends on which month it landed in.
 */
class WorldClockSpec : StringSpec({

    val opened = Instant.parse("2026-09-01T00:00:00Z")

    val calendar = WorldCalendar { day, months -> WorldTime(day.day + months * 30) }

    fun clockAt(now: Instant) = MonthlyWorldClock({ now }, calendar, opened, WorldTime(1000))

    "stands on the opening day at the instant the world opened" {
        clockAt(opened).today() shouldBe WorldTime(1000)
    }

    "steps one month for one real day" {
        clockAt(opened.plusSeconds(24 * 60 * 60)).today() shouldBe WorldTime(1030)
    }

    "does not step until a real day is whole, because a month is a month" {
        clockAt(opened.plusSeconds(23 * 60 * 60 + 59 * 60)).today() shouldBe WorldTime(1000)
    }

    "steps a year of months for a year of days" {
        clockAt(opened.plusSeconds(365L * 24 * 60 * 60)).today() shouldBe WorldTime(1000 + 365 * 30)
    }

    "stands still before the world opened rather than running backwards" {
        clockAt(opened.minusSeconds(10L * 24 * 60 * 60)).today() shouldBe WorldTime(1000)
    }
})
