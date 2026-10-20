package villages.application

import villages.domain.challenge.Challenge
import villages.domain.challenge.ChallengeCatalogue
import villages.domain.challenge.ChallengeResult
import villages.domain.challenge.ChallengeRules
import villages.domain.challenge.ChallengeSetup

/**
 * The challenge fought for Adam's simulator: the engine on the catalogue and the rules in force at the moment of
 * asking, from the seed the page gives, or one drawn here. The luck is choosing the seed, and it is the
 * application's, as the fate engine's dice are (0083): the page may give one because it is an instrument, never a
 * player's. Nothing is stored. See decision record 0105.
 */
class ChallengeSimulator(
    private val catalogue: () -> ChallengeCatalogue,
    private val rules: () -> ChallengeRules,
    private val seeds: Seeds,
) {
    /** [setup] fought out from [seed], or from one drawn; throws [SetupRefused] with every reason it cannot be. */
    fun simulate(setup: ChallengeSetup, seed: Long?): ChallengeResult {
        val content = catalogue()
        val refused = setup.refusals(content)
        if (refused.isNotEmpty()) throw SetupRefused(refused)
        return Challenge.resolve(setup, seed ?: seeds.draw(), content, rules())
    }
}

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
