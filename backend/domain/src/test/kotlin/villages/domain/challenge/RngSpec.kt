package villages.domain.challenge

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe

class RngSpec : StringSpec({

    "it is SplitMix64, value for value, as its reference gives it for the seed 1234567" {
        val rng = Rng(1234567)
        List(5) { rng.nextLong().toULong() } shouldBe listOf(
            6457827717110365317UL,
            3203168211198807973UL,
            9817491932198370423UL,
            4593380528125082431UL,
            16408922859458223821UL,
        )
    }

    "a draw below a number is never it, and every number below it comes up about as often" {
        val rng = Rng(20261020)
        val counts = IntArray(6)
        repeat(60_000) { counts[rng.below(6)]++ }
        counts.all { it in 9_500..10_500 } shouldBe true
    }

    "a pick from one thing takes it without drawing, so it leaves the luck where it was" {
        val rng = Rng(7)
        rng.pick(listOf("only")) shouldBe "only"
        rng.nextLong() shouldBe Rng(7).nextLong()
    }

    "a certain chance always comes up, and none never does" {
        val rng = Rng(3)
        List(100) { rng.chance(100.0) }.all { it } shouldBe true
        List(100) { rng.chance(0.0) }.none { it } shouldBe true
    }
})
