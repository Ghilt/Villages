package villages.application

import villages.domain.challenge.Challenge
import villages.domain.challenge.ChallengeCatalogue
import villages.domain.challenge.ChallengeResult
import villages.domain.challenge.ChallengeRules
import villages.domain.challenge.ChallengeSetup
import villages.domain.challenge.ChallengeSlice
import villages.domain.challenge.Progression
import villages.domain.challenge.Progressions

/**
 * The challenge fought for Adam's simulator: the engine on the catalogue and the rules in force at the moment of
 * asking, on a progression written by hand or drawn from a challenge kind, from the seed the page gives or one drawn
 * here. The luck is choosing the seed, and it is the application's, as the fate engine's dice are (0083): the page may
 * give one because it is an instrument, never a player's. Nothing is stored. See decision record 0105.
 */
class ChallengeSimulator(
    private val catalogue: () -> ChallengeCatalogue,
    private val rules: () -> ChallengeRules,
    private val seeds: Seeds,
) {
    /**
     * Each side's slices fought out on [progression], or on one drawn from the challenge kind [kind], from [seed] or
     * from one drawn; throws [SetupRefused] with every reason it cannot be.
     */
    fun simulate(a: List<ChallengeSlice>, b: List<ChallengeSlice>, progression: Progression?, kind: String?, seed: Long?): Fought {
        val content = catalogue()
        val luck = seed ?: seeds.draw()
        val fought = progression ?: when (kind) {
            null -> throw SetupRefused(listOf("a challenge has a progression written by hand, or a kind to draw one from"))
            else -> Progressions.draw(content.kinds[kind] ?: throw SetupRefused(listOf("there is no challenge kind '$kind'")), luck)
        }
        val setup = ChallengeSetup(a, b, fought)
        val refused = setup.refusals(content)
        if (refused.isNotEmpty()) throw SetupRefused(refused)
        return Fought(setup, Challenge.resolve(setup, luck, content, rules()))
    }
}

/** A challenge fought: the setup it was fought on, its progression drawn when it was, and what it came to. */
data class Fought(val setup: ChallengeSetup, val result: ChallengeResult)

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
