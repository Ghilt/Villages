package villages.domain

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

class TreasurySpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")

    "runs the rate on from the instant it was declared" {
        val treasury = Treasury(amount = 100, ratePerSecond = 2.0, asOf = noon)

        treasury.at(noon) shouldBe 100
        treasury.at(noon.plusSeconds(30)) shouldBe 160
    }

    "rounds down, so a client and the server never disagree by a coin" {
        Treasury(0, 0.3, noon).at(noon.plusSeconds(10)) shouldBe 3
        Treasury(0, 0.3, noon).at(noon.plusMillis(9_999)) shouldBe 2
    }

    "does not run backwards for a clock that is behind" {
        Treasury(50, 1.0, noon).at(noon.minusSeconds(60)) shouldBe 50
    }
})
