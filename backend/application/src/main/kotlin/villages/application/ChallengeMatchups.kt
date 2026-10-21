package villages.application

import villages.domain.Stat
import villages.domain.challenge.Aspect
import villages.domain.challenge.Challenge
import villages.domain.challenge.ChallengeCatalogue
import villages.domain.challenge.ChallengeRules
import villages.domain.challenge.ChallengeSetup
import villages.domain.challenge.ChallengeSlice
import villages.domain.challenge.Ending
import villages.domain.challenge.Fits
import villages.domain.challenge.Progressions
import villages.domain.challenge.Rng
import villages.domain.challenge.Side
import villages.domain.challenge.StandIn

/**
 * Every aspect weighed against every other, for Adam's simulator: for each pair, side A a slice of the one and side B a
 * slice of the other, fought [runs] times on progressions drawn from a challenge kind, and summed. A slice is the
 * balance's slice every house starts with, carrying two of its aspect's effects, and every way of choosing two takes
 * its turn, so no one build speaks for its aspect; a slot holds a stand-in from the middle of its range, a key figure
 * of ten in every stat or a building of level two. The luck is one seed, each cell's runs drawn from it in turn. What
 * the page draws as a grid of who wins how often. See decision record 0107.
 */
class ChallengeMatchups(
    private val catalogue: () -> ChallengeCatalogue,
    private val rules: () -> ChallengeRules,
    private val seeds: Seeds,
) {
    fun weigh(kind: String, runs: Int, seed: Long?): Matchups {
        if (runs !in 1..MOST_RUNS) throw SetupRefused(listOf("a matchup is 1 to $MOST_RUNS runs, not $runs"))
        val content = catalogue()
        val drawing = content.kinds[kind] ?: throw SetupRefused(listOf("there is no challenge kind '$kind'"))
        val rules = rules()
        val first = seed ?: seeds.draw()
        val luck = Rng(first)
        val builds = Aspect.entries.associateWith { buildsOf(it, content, rules) }
        val cells = Aspect.entries.map { a ->
            Aspect.entries.map { b ->
                val pairings = builds.getValue(a).flatMap { one -> builds.getValue(b).map { other -> one to other } }
                val counting = MatchupCell.Counting()
                repeat(runs) { run ->
                    val (one, other) = pairings[run % pairings.size]
                    val seedOfRun = luck.nextLong() and Seeds.MOST
                    val setup = ChallengeSetup(listOf(one), listOf(other), Progressions.draw(drawing, seedOfRun))
                    counting.add(Challenge.resolve(setup, seedOfRun, content, rules).outcome)
                }
                counting.cell()
            }
        }
        return Matchups(kind, runs, first, Aspect.entries, cells)
    }

    /** Every slice of [aspect] the simulator weighs: one for each way of choosing two of its effects, or one with what it has. */
    private fun buildsOf(aspect: Aspect, content: ChallengeCatalogue, rules: ChallengeRules): List<ChallengeSlice> {
        val effects = content.effectsOf(aspect)
        val choices = if (effects.size <= 2) {
            listOf(effects)
        } else {
            effects.indices.flatMap { i -> (i + 1 until effects.size).map { j -> listOf(effects[i], effects[j]) } }
        }
        return choices.map { chosen ->
            ChallengeSlice(
                aspect = aspect,
                power = rules.slice.power,
                integrity = rules.slice.integrity,
                summonCount = rules.slice.summonCount,
                effects = chosen.map { it.id },
                slotted = chosen.mapNotNull { effect ->
                    effect.slot?.let { slot ->
                        effect.id to when (slot.fits) {
                            Fits.KEY_FIGURE -> StandIn.KeyFigure("a middling figure", Stat.entries.associateWith { MIDDLING_STAT })
                            Fits.STRUCTURE -> StandIn.Building("a middling building", MIDDLING_LEVEL)
                        }
                    }
                }.toMap(),
            )
        }
    }

    companion object {
        const val MOST_RUNS = 1000
        private const val MIDDLING_STAT = 10
        private const val MIDDLING_LEVEL = 2
    }
}

/** Every aspect against every other: [cells] by side A's aspect, then side B's, in [aspects]' order. */
data class Matchups(val kind: String, val runs: Int, val seed: Long, val aspects: List<Aspect>, val cells: List<List<MatchupCell>>)

/** One pairing's runs summed: each side's wins, the even ends, how many were pulled to an end, and the mean end tug toward A. */
data class MatchupCell(val wonByA: Int, val wonByB: Int, val even: Int, val pulled: Int, val meanTug: Double) {
    class Counting {
        private var runs = 0
        private var wonByA = 0
        private var wonByB = 0
        private var pulled = 0
        private var tugs = 0.0

        fun add(outcome: villages.domain.challenge.Outcome) {
            runs++
            when (outcome.wonBy) {
                Side.A -> wonByA++
                Side.B -> wonByB++
                null -> Unit
            }
            if (outcome.ended == Ending.PULLED) pulled++
            tugs += outcome.tug
        }

        fun cell(): MatchupCell = MatchupCell(wonByA, wonByB, runs - wonByA - wonByB, pulled, tugs / runs)
    }
}
