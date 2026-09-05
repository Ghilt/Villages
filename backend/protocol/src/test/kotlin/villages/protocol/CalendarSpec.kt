package villages.protocol

import io.kotest.assertions.throwables.shouldThrow
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

    "reads every shared vector the browser is also held to, both ways" {
        fixture["daysPerYear"].asLong() shouldBe Calendar.DAYS_PER_YEAR
        vectors.size shouldBe 7

        for (vector in vectors) {
            val day = vector["day"].asLong()
            Calendar.yearOf(day) shouldBe vector["year"].asLong()
            Calendar.dayOfYearOf(day) shouldBe vector["dayOfYear"].asInt()
            Calendar.dayOf(vector["year"].asLong(), vector["dayOfYear"].asInt()) shouldBe day
            Calendar.describe(day) shouldBe vector["said"].asString()
        }
    }

    "goes from a day to a year and back to the same day, whatever the day" {
        checkAll(Arb.long(0L, 1_000_000L)) { day ->
            Calendar.dayOf(Calendar.yearOf(day), Calendar.dayOfYearOf(day)) shouldBe day
        }
    }

    "refuses a year before the first or a day a year has not got" {
        shouldThrow<IllegalArgumentException> { Calendar.dayOf(0, 1) }
        shouldThrow<IllegalArgumentException> { Calendar.dayOf(1, 0) }
        shouldThrow<IllegalArgumentException> { Calendar.dayOf(1, 366) }
    }
})
