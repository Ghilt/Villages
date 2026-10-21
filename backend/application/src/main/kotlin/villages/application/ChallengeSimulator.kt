package villages.application

import villages.domain.challenge.Challenge
import villages.domain.challenge.ChallengeCatalogue
import villages.domain.challenge.ChallengeResult
import villages.domain.challenge.ChallengeRules
import villages.domain.challenge.ChallengeSetup
import villages.domain.challenge.ChallengeSlice
import villages.domain.challenge.Progression
import villages.domain.challenge.Progressions
import villages.domain.challenge.Rng

/**
 * The challenge fought for Adam's simulator: the engine on the catalogue and the rules in force at the moment of
 * asking, on a progression written by hand or drawn from a challenge kind, from the seed the page gives or one drawn
 * here. The luck is choosing the seed, and it is the application's, as the fate engine's dice are (0083): the page may
 * give one because it is an instrument, never a player's. Nothing is stored. See decision record 0107.
 */
class ChallengeSimulator(
    private val catalogue: () -> ChallengeCatalogue,
    private val rules: () -> ChallengeRules,
    private val seeds: Seeds,
) {
    /**
     * Each side's slices fought out on [progression], or on one drawn from the challenge kind [kind], from [seed] or
     * from one drawn; throws [SetupRefused] with every reason it cannot be. With more than one of [runs], the same
     * sides are fought that many times and what they came to is summed: the first run is the seed's, whose moments are
     * kept, and each after it is fought from a seed worked out from the one before, on a progression of its own when
     * drawn from a kind and on the same one when written by hand.
     */
    fun simulate(
        a: List<ChallengeSlice>,
        b: List<ChallengeSlice>,
        progression: Progression?,
        kind: String?,
        seed: Long?,
        runs: Int = 1,
    ): Fought {
        if (runs !in 1..MOST_RUNS) throw SetupRefused(listOf("a batch is 1 to $MOST_RUNS runs, not $runs"))
        val content = catalogue()
        val first = seed ?: seeds.draw()
        val fight = { luck: Long ->
            val fought = progression ?: when (kind) {
                null -> throw SetupRefused(listOf("a challenge has a progression written by hand, or a kind to draw one from"))
                else -> Progressions.draw(content.kinds[kind] ?: throw SetupRefused(listOf("there is no challenge kind '$kind'")), luck)
            }
            val setup = ChallengeSetup(a, b, fought)
            val refused = setup.refusals(content)
            if (refused.isNotEmpty()) throw SetupRefused(refused)
            Fought(setup, Challenge.resolve(setup, luck, content, rules()))
        }
        val shown = fight(first)
        if (runs == 1) return shown
        val summing = Batch.Summing(rules().tugEnds).apply { add(shown) }
        val after = Rng(first)
        repeat(runs - 1) { summing.add(fight(after.nextLong() and Seeds.MOST)) }
        return shown.copy(batch = summing.batch())
    }

    companion object {
        const val MOST_RUNS = 10_000
    }
}

/** A challenge fought: the setup it was fought on, its progression drawn when it was, what it came to, and its batch. */
data class Fought(val setup: ChallengeSetup, val result: ChallengeResult, val batch: Batch? = null)

/** Where a challenge's seed comes from when nobody gives one: a whole number a page can type back. */
fun interface Seeds {
    fun draw(): Long

    companion object {
        /** The largest whole number a page holds exactly, 2^53 - 1: a seed is never more. */
        const val MOST = (1L shl 53) - 1
    }
}

/** A challenge that cannot be fought as it was set up, and every reason why. */
class SetupRefused(val reasons: List<String>) : RuntimeException(reasons.joinToString("; "))
