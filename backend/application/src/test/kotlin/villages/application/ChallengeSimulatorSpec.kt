package villages.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.challenge.Aspect
import villages.domain.challenge.ChallengeCatalogue
import villages.domain.challenge.ChallengeEffect
import villages.domain.challenge.ChallengeSetup
import villages.domain.challenge.ChallengeSlice
import villages.domain.challenge.Fires
import villages.domain.challenge.Happening
import villages.domain.challenge.Progression
import villages.domain.challenge.SummonSpec

class ChallengeSimulatorSpec : StringSpec({

    val content = ChallengeCatalogue(
        effects = listOf(ChallengeEffect("violence.sellswords", Aspect.VIOLENCE, Fires.TRIGGER, summons = "mercenary")),
        summons = mapOf("mercenary" to SummonSpec(Aspect.VIOLENCE, mapOf("pulls" to 10.0))),
        kinds = emptyMap(),
    )
    val hiring = ChallengeSlice(Aspect.VIOLENCE, 50.0, 50.0, 1, listOf("violence.sellswords"))
    val setup = ChallengeSetup(listOf(hiring), listOf(hiring.copy(effects = emptyList())), Progression(5, listOf(Happening(Aspect.REASON))))
    var drawn = 0L
    val simulator = ChallengeSimulator({ content }, { TEST_BALANCE.challenge }) { ++drawn }

    "a challenge is fought from the seed given, or from one drawn when none is, on the content in force" {
        simulator.simulate(setup, 99).seed shouldBe 99L
        simulator.simulate(setup, null).seed shouldBe 1L
        simulator.simulate(setup, null).outcome.tug shouldBe 40.0
    }

    "a setup that cannot be fought is refused with every reason it cannot be" {
        val refused = shouldThrow<SetupRefused> { simulator.simulate(setup.copy(a = emptyList()), 1) }
        refused.reasons shouldBe listOf("side A brings 1 to 3 slices, not 0")
    }
})
