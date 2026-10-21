package villages.domain.challenge

/**
 * The challenge engine's other half: a progression drawn from a challenge kind - its seconds and its number of
 * happenings each drawn between the kind's least and most, each happening's aspect drawn by the kind's weights, and,
 * at the kind's chance, a second aspect drawn by weight from the other nine. Drawn from a seed of its own, worked out
 * from the challenge's, so the same seed gives the same progression and the same challenge fought on it, and the two
 * draws do not walk in step. See decision record 0107.
 */
object Progressions {
    fun draw(kind: ChallengeKind, seed: Long): Progression {
        val rng = Rng(seed xor SALT)
        val seconds = between(kind.seconds, rng)
        return Progression(seconds, List(between(kind.happenings, rng)) { happeningOf(kind, rng) })
    }

    private fun happeningOf(kind: ChallengeKind, rng: Rng): Happening {
        val first = weighted(kind.weights, rng)
        val others = kind.weights - first
        if (!rng.chance(kind.twoAspects) || others.values.none { it > 0.0 }) return Happening(first)
        return Happening(first, weighted(others, rng))
    }

    private fun between(range: IntRange, rng: Rng): Int = range.first + rng.below(range.last - range.first + 1)

    /** An aspect drawn as its weight is of all of them, an aspect weighing nothing never. */
    private fun weighted(weights: Map<Aspect, Double>, rng: Rng): Aspect {
        val weighing = Aspect.entries.filter { (weights[it] ?: 0.0) > 0.0 }
        var at = rng.nextDouble() * weighing.sumOf { weights.getValue(it) }
        weighing.forEach { aspect ->
            at -= weights.getValue(aspect)
            if (at < 0.0) return aspect
        }
        return weighing.last()
    }

    /** What sets a progression's draw apart from the challenge's own luck, from the same seed. */
    private const val SALT = 0x5bd1e9955bd1e995L
}
