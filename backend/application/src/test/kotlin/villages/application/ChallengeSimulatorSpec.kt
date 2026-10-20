package villages.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.challenge.Aspect
import villages.domain.challenge.ChallengeCatalogue
import villages.domain.challenge.ChallengeEffect
import villages.domain.challenge.ChallengeKind
import villages.domain.challenge.ChallengeSlice
import villages.domain.challenge.Fires
import villages.domain.challenge.Happening
import villages.domain.challenge.Progression
import villages.domain.challenge.SummonSpec

class ChallengeSimulatorSpec : StringSpec({

    val content = ChallengeCatalogue(
        effects = listOf(ChallengeEffect("violence.sellswords", Aspect.VIOLENCE, Fires.TRIGGER, summons = "mercenary")),
        summons = mapOf("mercenary" to SummonSpec(Aspect.VIOLENCE, mapOf("pulls" to 10.0))),
        kinds = mapOf("skirmish" to ChallengeKind(5..9, 1..3, 0.0, mapOf(Aspect.REASON to 1.0))),
    )
    val hiring = listOf(ChallengeSlice(Aspect.VIOLENCE, 50.0, 50.0, 1, listOf("violence.sellswords")))
    val idle = listOf(ChallengeSlice(Aspect.VIOLENCE, 50.0, 50.0, 1, emptyList()))
    val byHand = Progression(5, listOf(Happening(Aspect.REASON)))
    var drawn = 0L
    val simulator = ChallengeSimulator({ content }, { TEST_BALANCE.challenge }) { ++drawn }

    "a challenge is fought from the seed given, or from one drawn when none is, on the content in force" {
        simulator.simulate(hiring, idle, byHand, null, 99).result.seed shouldBe 99L
        simulator.simulate(hiring, idle, byHand, null, null).result.seed shouldBe 1L
        simulator.simulate(hiring, idle, byHand, null, null).result.outcome.tug shouldBe 40.0
    }

    "a progression is drawn from a challenge kind by the seed, the same seed drawing the same one" {
        val once = simulator.simulate(hiring, idle, null, "skirmish", 7)
        (once.setup.progression.seconds in 5..9) shouldBe true
        once.setup.progression.happenings.all { it.aspects == listOf(Aspect.REASON) } shouldBe true
        simulator.simulate(hiring, idle, null, "skirmish", 7) shouldBe once
    }

    "a setup that cannot be fought is refused with every reason it cannot be" {
        shouldThrow<SetupRefused> { simulator.simulate(emptyList(), idle, byHand, null, 1) }.reasons shouldBe
            listOf("side A brings 1 to 3 slices, not 0")
        shouldThrow<SetupRefused> { simulator.simulate(hiring, idle, null, "siege", 1) }.reasons shouldBe
            listOf("there is no challenge kind 'siege'")
        shouldThrow<SetupRefused> { simulator.simulate(hiring, idle, null, null, 1) }.reasons shouldBe
            listOf("a challenge has a progression written by hand, or a kind to draw one from")
    }
})
