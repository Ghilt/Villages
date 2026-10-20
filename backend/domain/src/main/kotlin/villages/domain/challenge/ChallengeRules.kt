package villages.domain.challenge

/**
 * The numbers of a challenge's rules that belong to no one effect, the balance's `challenge` group: the aspect
 * [boost]; how far the tug runs either way, [tugEnds]; what a building put on the line pays as it arrives for each of
 * its levels, [buildingArrives], and the shares of what a thing on the line arrives with that it pulls a second,
 * [pullShare], and adds to its slice's integrity, [integrityShare]; the effectiveness out of a hundred a building or a
 * person loses when killed on the line; and the [slice] every house starts with. See decision record 0105.
 */
data class ChallengeRules(
    val boost: Double,
    val tugEnds: Double,
    val buildingArrives: Double,
    val pullShare: Double,
    val integrityShare: Double,
    val effectivenessLost: Double,
    val slice: SliceStart,
) {
    init {
        require(boost >= 1.0 && boost.isFinite()) { "the boost grows what it boosts, so it is one or more, not $boost" }
        require(tugEnds > 0.0 && tugEnds.isFinite()) { "the tug runs some way either side of the middle, not $tugEnds" }
        require(listOf(buildingArrives, pullShare, integrityShare).all { it >= 0.0 && it.isFinite() }) {
            "what a thing on the line brings is nothing or more"
        }
        require(effectivenessLost in 0.0..100.0) { "effectivenessLost is out of a hundred, not $effectivenessLost" }
    }
}

/** What a slice starts at: the one every house begins with, and a new slice on the simulator. */
data class SliceStart(val power: Double, val integrity: Double, val summonCount: Int) {
    init {
        require(power >= 0.0 && integrity >= 0.0 && summonCount >= 0) { "a slice starts at nothing or more" }
    }
}
