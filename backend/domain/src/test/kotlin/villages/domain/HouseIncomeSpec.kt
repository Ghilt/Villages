package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe

/** The house: what each source pays it, and its stocks running at the sum. The fixtures are HouseFixtures.kt. */
class HouseIncomeSpec : StringSpec({
    val mill = IncomeSource("structure:5d000000-0000-4000-8000-000000000001")
    val castle = IncomeSource("structure:5d000000-0000-4000-8000-000000000002")
    val anHourOn = noon.plusSeconds(3_600)

    fun paying(source: IncomeSource, rates: Map<Resource, Double>, at: java.time.Instant = noon) =
        SetIncome(house, source, rates, day, at)

    "a source paying is written with its rates, and the stock runs at them from then" {
        val written = HouseDecider.decide(paying(mill, mapOf(Resource.WEALTH to 0.5)), standing)

        written shouldBe listOf(HouseIncomeChanged(house, mill, mapOf(Resource.WEALTH to 0.5), day, noon))
        // The founding wealth spent, so it counts from nothing.
        after(paying(mill, mapOf(Resource.WEALTH to 0.5))).stockOf(Resource.WEALTH).at(anHourOn) shouldBe 1_800L
    }

    "two sources paying the same resource add up, and one stopping leaves the other" {
        val both = after(paying(mill, mapOf(Resource.WEALTH to 0.5)), paying(castle, mapOf(Resource.WEALTH to 0.25)))
        both.stockOf(Resource.WEALTH).ratePerSecond shouldBe 0.75

        val one = after(
            paying(mill, mapOf(Resource.WEALTH to 0.5)),
            paying(castle, mapOf(Resource.WEALTH to 0.25)),
            paying(mill, emptyMap(), anHourOn),
        )
        one.stockOf(Resource.WEALTH).ratePerSecond shouldBe 0.25
        one.treasury.incomes.bySource.keys shouldBe setOf(castle)
    }

    "a change keeps what had come in: the stock is brought up to then before it runs on at the new rate" {
        val house = after(paying(mill, mapOf(Resource.WEALTH to 1.0)), paying(mill, mapOf(Resource.WEALTH to 2.0), anHourOn))

        house.stockOf(Resource.WEALTH).at(anHourOn.plusSeconds(10)) shouldBe 3_600L + 20
    }

    "the same rates again write nothing, and nor do zeros for a source that pays nothing" {
        val paid = after(paying(mill, mapOf(Resource.WEALTH to 0.5)))

        HouseDecider.decide(paying(mill, mapOf(Resource.WEALTH to 0.5, Resource.PIETY to 0.0)), paid).shouldBeEmpty()
        HouseDecider.decide(paying(castle, mapOf(Resource.PIETY to 0.0)), paid).shouldBeEmpty()
    }

    "a rate is a number, and a house nobody founded is paid nothing" {
        shouldThrow<HouseError.InvalidAmount> { HouseDecider.decide(paying(mill, mapOf(Resource.WEALTH to Double.NaN)), standing) }
        shouldThrow<HouseError.NoSuchHouse> { HouseDecider.decide(paying(mill, mapOf(Resource.WEALTH to 0.5)), HouseDecider.initial) }
    }
})
