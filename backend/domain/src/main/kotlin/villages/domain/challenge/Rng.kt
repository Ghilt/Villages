package villages.domain.challenge

/**
 * The challenge's luck, drawn from one seed: SplitMix64, written out here rather than taken from `kotlin.random`,
 * whose sequence a new Kotlin may change, so a seed gives the same challenge on every version of the engine's rules.
 * Its published reference values pin it (`RngSpec`). See decision record 0107.
 */
class Rng(seed: Long) {
    private var state = seed

    fun nextLong(): Long {
        state += GAMMA
        var z = state
        z = (z xor (z ushr 30)) * MIX_1
        z = (z xor (z ushr 27)) * MIX_2
        return z xor (z ushr 31)
    }

    /** A number from nought up to but not including one, from the top 53 bits. */
    fun nextDouble(): Double = (nextLong() ushr 11) * UNIT

    /** A whole number from nought up to but not including [n], each as likely: what falls in the uneven top is drawn again. */
    fun below(n: Int): Int {
        require(n > 0) { "a draw is from one thing at least, not $n" }
        val bound = n.toLong()
        val limit = Long.MAX_VALUE - Long.MAX_VALUE % bound
        while (true) {
            val drawn = nextLong() ushr 1
            if (drawn < limit) return (drawn % bound).toInt()
        }
    }

    /** Whether a chance out of a hundred came up. */
    fun chance(percent: Double): Boolean = nextDouble() * HUNDRED < percent

    /** One of [things], each as likely; one alone is taken without a draw. */
    fun <T> pick(things: List<T>): T {
        require(things.isNotEmpty()) { "a pick is from one thing at least" }
        return if (things.size == 1) things.first() else things[below(things.size)]
    }

    private companion object {
        const val GAMMA = -0x61c8864680b583ebL
        const val MIX_1 = -0x40a7b892e31b1a47L
        const val MIX_2 = -0x6b2fb644ecceee15L
        const val UNIT = 1.0 / (1L shl 53)
        const val HUNDRED = 100.0
    }
}
