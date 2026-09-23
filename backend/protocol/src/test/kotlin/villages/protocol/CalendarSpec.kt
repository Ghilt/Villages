package villages.protocol

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll
import tools.jackson.databind.json.JsonMapper
import java.io.File

class CalendarSpec : StringSpec({

    val fixture = JsonMapper().readTree(File("../../contracts/fixtures/calendar.json"))
    val vectors = (0 until fixture["vectors"].size()).map { fixture["vectors"][it] }
    val spans = (0 until fixture["spans"].size()).map { fixture["spans"][it] }

    "names the months as the shared fixture does, which the browser is held to as well" {
        Calendar.MONTHS shouldBe (0 until fixture["months"].size()).map { fixture["months"][it].asString() }
    }

    "reads every shared vector both ways, and spells it" {
        vectors.size shouldBe 10

        for (vector in vectors) {
            val day = vector["day"].asLong()
            Calendar.yearOf(day) shouldBe vector["year"].asLong()
            Calendar.monthOf(day) shouldBe vector["month"].asInt()
            Calendar.dayOfMonthOf(day) shouldBe vector["dayOfMonth"].asInt()
            Calendar.dayOf(vector["year"].asLong(), vector["month"].asInt(), vector["dayOfMonth"].asInt()) shouldBe day
            Calendar.describe(day) shouldBe vector["said"].asString()
        }
    }

    "steps every shared span by months, and spells where it lands" {
        spans.size shouldBe 7

        for (span in spans) {
            val landed = Calendar.plusMonths(span["from"].asLong(), span["months"].asLong())
            landed shouldBe span["to"].asLong()
            Calendar.describe(landed) shouldBe span["said"].asString()
        }
    }

    "counts the whole months between every shared pair, and only the whole ones" {
        val betweens = (0 until fixture["betweens"].size()).map { fixture["betweens"][it] }
        betweens.size shouldBe 8

        for (pair in betweens) {
            withClue(pair["name"].asString()) {
                Calendar.monthsBetween(pair["from"].asLong(), pair["to"].asLong()) shouldBe
                    pair["months"].asLong()
            }
        }
    }

    "goes from a day to a date and back to the same day, whatever the day" {
        checkAll(Arb.long(0L, 1_000_000L)) { day ->
            val date = Calendar.dateOf(day)
            Calendar.dayOf(date.year.toLong(), date.monthValue, date.dayOfMonth) shouldBe day
        }
    }

    "refuses a date the calendar has not got" {
        shouldThrow<IllegalArgumentException> { Calendar.dayOf(0, 1, 1) }
        shouldThrow<IllegalArgumentException> { Calendar.dayOf(1, 0, 1) }
        shouldThrow<IllegalArgumentException> { Calendar.dayOf(1, 13, 1) }
        shouldThrow<IllegalArgumentException> { Calendar.dayOf(1, 1, 0) }
        shouldThrow<IllegalArgumentException> { Calendar.dayOf(1301, 2, 29) }
    }

    "holds the day of the month where it can and pulls it back where it cannot" {
        Calendar.describe(Calendar.plusMonths(Calendar.dayOf(1200, 1, 31), 1)) shouldBe
            "the twenty-ninth of February, year 1200"
        Calendar.describe(Calendar.plusMonths(Calendar.dayOf(1201, 1, 31), 1)) shouldBe
            "the twenty-eighth of February, year 1201"
    }
})
