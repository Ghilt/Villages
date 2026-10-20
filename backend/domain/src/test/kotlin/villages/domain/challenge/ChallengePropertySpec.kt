package villages.domain.challenge

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import villages.domain.Stat
import kotlin.math.abs
import kotlin.random.Random

/**
 * The rules that must always hold, over hundreds of challenges made up at random from the test content: the tug ends
 * within its ends, and at one when pulled there; the changes add up to it; the same seed fights the same challenge;
 * time only runs forward; and no side ever has more summons than its slices let it have, which the engine itself
 * checks as each one comes. Every effect is in the test content, and most slots have a stand-in in them.
 */
class ChallengePropertySpec : StringSpec({

    "every challenge made up at random keeps the rules that must always hold" {
        repeat(400) { made ->
            val random = Random(made)
            val setup = ChallengeSetup(sideOf(random), sideOf(random), progressionOf(random))
            val seed = random.nextLong()
            val result = Challenge.resolve(setup, seed, TEST_CATALOGUE, TEST_RULES)

            (abs(result.outcome.tug) <= TEST_RULES.tugEnds) shouldBe true
            if (result.outcome.ended == Ending.PULLED) abs(result.outcome.tug) shouldBe TEST_RULES.tugEnds
            result.moments.sumOf { it.tugDelta } shouldBe (result.outcome.tug plusOrMinus 1e-6)
            result.moments.zipWithNext().all { (was, now) -> now.second >= was.second && now.happening >= was.happening } shouldBe true
            Challenge.resolve(setup, seed, TEST_CATALOGUE, TEST_RULES) shouldBe result
        }
    }
})

private val EFFECTS = TEST_CATALOGUE.effects.groupBy { it.aspect }

private fun sideOf(random: Random): List<ChallengeSlice> = List(random.nextInt(1, 4)) {
    val aspect = EFFECTS.keys.random(random)
    val effects = EFFECTS.getValue(aspect).map { it.id }.shuffled(random).take(random.nextInt(0, 3))
    val slotted = effects.mapNotNull { id -> TEST_CATALOGUE.effect(id)?.slot?.let { id to it } }
        .filter { random.nextInt(4) > 0 }
        .associate { (id, slot) ->
            id to when (slot.fits) {
                Fits.KEY_FIGURE -> StandIn.KeyFigure("Ines", Stat.entries.associateWith { random.nextInt(1, 21) })
                Fits.STRUCTURE -> StandIn.Building("Lund", random.nextInt(1, 4))
            }
        }
    slice(aspect, *effects.toTypedArray(), power = random.nextInt(0, 101).toDouble(), integrity = random.nextInt(0, 101).toDouble(), summonCount = random.nextInt(0, 5), slotted = slotted)
}

private fun progressionOf(random: Random): Progression {
    val seconds = random.nextInt(1, 121)
    val happenings = List(random.nextInt(1, minOf(6, seconds) + 1)) {
        Happening(Aspect.entries.shuffled(random).take(random.nextInt(1, 3)))
    }
    return Progression(seconds, happenings)
}
