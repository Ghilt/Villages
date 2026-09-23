package villages.domain

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

class StockSpec : StringSpec({

    val noon = Instant.parse("2026-09-04T12:00:00Z")

    "a stock is what it was plus what the rate has earned since" {
        val stock = Stock(total = 100, ratePerSecond = 2.0, asOf = noon)

        stock.at(noon) shouldBe 100
        stock.at(noon.plusSeconds(30)) shouldBe 160
    }

    "a part-earned unit is not earned yet, so the number never runs ahead of the world" {
        Stock(0, 0.3, noon).at(noon.plusSeconds(10)) shouldBe 3
        Stock(0, 0.3, noon).at(noon.plusMillis(9_999)) shouldBe 2
    }

    "before the instant it was true, a stock is what it was and the rate has not run" {
        Stock(50, 1.0, noon).at(noon.minusSeconds(60)) shouldBe 50
    }

    "a stock standing still is the same however long you look at it" {
        Stock(120, 0.0, noon).at(noon.plusSeconds(100_000)) shouldBe 120
    }

    "a house is founded with one stock of every resource, all of it nothing and none of it growing" {
        val stocks = emptyStocks(noon)

        stocks.keys shouldBe Resource.entries.toSet()
        stocks.values.map { it.total }.toSet() shouldBe setOf(0L)
        stocks.values.map { it.ratePerSecond }.toSet() shouldBe setOf(0.0)
    }
})
