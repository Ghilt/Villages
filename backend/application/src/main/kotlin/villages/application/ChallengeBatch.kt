package villages.application

import villages.domain.challenge.Ending
import villages.domain.challenge.Side

/**
 * What a batch of challenges came to: how many were fought, how many each side won and how many ended even, how many
 * each side pulled to the end, and the mean of where the tug ended, toward side A; and how they spread - for every
 * second, how many runs stood in each of [ROWS] bands of the tug, and in which band each run ended. The bands run from
 * pulled to B's end, the first, through twenty of equal width between the ends, to pulled to A's end, the last. A run
 * pulled to an end stays there until its own seconds are up; one whose time ran out counts no further. What the
 * simulator's page draws as a heatmap, the seed's run over it. See decision record 0105.
 */
data class Batch(
    val runs: Int,
    val wonByA: Int,
    val wonByB: Int,
    val even: Int,
    val pulledByA: Int,
    val pulledByB: Int,
    val meanTug: Double,
    val tugEnds: Double,
    /** For every second of the longest run, how many runs stood in each band then. */
    val spread: List<List<Int>>,
    /** How many runs ended in each band. */
    val ends: List<Int>,
) {
    /** A batch summed as its runs are fought, each forgotten once it is counted, so ten thousand cost no more than one. */
    class Summing(private val tugEnds: Double) {
        private val spread = mutableListOf<IntArray>()
        private val ends = IntArray(ROWS)
        private var runs = 0
        private var wonByA = 0
        private var wonByB = 0
        private var pulledByA = 0
        private var pulledByB = 0
        private var tugs = 0.0

        fun add(fought: Fought) {
            val outcome = fought.result.outcome
            runs++
            when (outcome.wonBy) {
                Side.A -> wonByA++
                Side.B -> wonByB++
                null -> Unit
            }
            if (outcome.ended == Ending.PULLED) if (outcome.wonBy == Side.A) pulledByA++ else pulledByB++
            tugs += outcome.tug
            ends[rowOf(outcome.tug, tugEnds)]++
            tugsBySecond(fought).forEachIndexed { second, tug ->
                while (spread.size <= second) spread += IntArray(ROWS)
                spread[second][rowOf(tug, tugEnds)]++
            }
        }

        fun batch(): Batch = Batch(
            runs = runs,
            wonByA = wonByA,
            wonByB = wonByB,
            even = runs - wonByA - wonByB,
            pulledByA = pulledByA,
            pulledByB = pulledByB,
            meanTug = tugs / runs,
            tugEnds = tugEnds,
            spread = spread.map { it.toList() },
            ends = ends.toList(),
        )
    }

    companion object {
        /** The bands between the ends, of equal width; with the two ends themselves, [ROWS]. */
        const val BANDS = 20
        const val ROWS = BANDS + 2

        fun of(fights: List<Fought>, tugEnds: Double): Batch = Summing(tugEnds).apply { fights.forEach(::add) }.batch()

        /** The band a tug stands in: pulled to B's end, one of the twenty between, or pulled to A's end. */
        fun rowOf(tug: Double, tugEnds: Double): Int = when {
            tug <= -tugEnds -> 0
            tug >= tugEnds -> ROWS - 1
            else -> 1 + ((tug + tugEnds) / (2 * tugEnds) * BANDS).toInt().coerceIn(0, BANDS - 1)
        }

        /** Where the tug stood at the end of every second of a run's challenge, carried through seconds nothing moved it. */
        private fun tugsBySecond(fought: Fought): DoubleArray {
            val moments = fought.result.moments
            val tugs = DoubleArray(fought.setup.progression.seconds)
            var tug = 0.0
            var at = 0
            for (second in tugs.indices) {
                while (at < moments.size && moments[at].second == second) tug = moments[at++].tugAfter
                tugs[second] = tug
            }
            return tugs
        }
    }
}
