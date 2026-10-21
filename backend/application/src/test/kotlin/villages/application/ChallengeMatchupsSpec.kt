package villages.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.Stat
import villages.domain.challenge.Aspect
import villages.domain.challenge.ChallengeCatalogue
import villages.domain.challenge.ChallengeEffect
import villages.domain.challenge.ChallengeKind
import villages.domain.challenge.ChallengeSlot
import villages.domain.challenge.Fires
import villages.domain.challenge.Fits
import villages.domain.challenge.SummonSpec

class ChallengeMatchupsSpec : StringSpec({

    val content = ChallengeCatalogue(
        effects = listOf(
            ChallengeEffect("violence.sellswords", Aspect.VIOLENCE, Fires.TRIGGER, summons = "mercenary"),
            ChallengeEffect("diplomacy.envoy", Aspect.DIPLOMACY, Fires.TRIGGER, slot = ChallengeSlot(Fits.KEY_FIGURE, Stat.KINDNESS)),
        ),
        summons = mapOf("mercenary" to SummonSpec(Aspect.VIOLENCE, mapOf("pulls" to 10.0))),
        kinds = mapOf("even" to ChallengeKind(10..20, 1..3, 20.0, Aspect.entries.associateWith { 1.0 })),
    )
    var drawn = 0L
    val matchups = ChallengeMatchups({ content }, { TEST_BALANCE.challenge }) { ++drawn }

    "every aspect is weighed against every other, a cell for each pairing, its runs summed" {
        val weighed = matchups.weigh("even", 30, 5)

        weighed.aspects shouldBe Aspect.entries
        weighed.cells.size shouldBe 10
        weighed.cells.all { row -> row.size == 10 && row.all { it.wonByA + it.wonByB + it.even == 30 } } shouldBe true
        weighed.cells[Aspect.VIOLENCE.ordinal][Aspect.HOLY.ordinal].wonByA shouldBe 30
        weighed.cells[Aspect.HOLY.ordinal][Aspect.HOLY.ordinal].even shouldBe 30
        weighed.cells[Aspect.HOLY.ordinal][Aspect.VIOLENCE.ordinal].wonByB shouldBe 30
    }

    "a key figure in a slot is a middling one: ten in every stat" {
        val weighed = matchups.weigh("even", 10, 5)

        weighed.cells[Aspect.DIPLOMACY.ordinal][Aspect.HOLY.ordinal].wonByA shouldBe 10
    }

    "the same seed weighs the same, and with none the server draws one" {
        matchups.weigh("even", 20, 9) shouldBe matchups.weigh("even", 20, 9)
        matchups.weigh("even", 1, null).seed shouldBe drawn
    }

    "a kind there is not, or runs past the bound, is refused" {
        shouldThrow<SetupRefused> { matchups.weigh("siege", 10, 1) }.reasons shouldBe listOf("there is no challenge kind 'siege'")
        shouldThrow<SetupRefused> { matchups.weigh("even", 1001, 1) }.reasons shouldBe listOf("a matchup is 1 to 1000 runs, not 1001")
    }
})
