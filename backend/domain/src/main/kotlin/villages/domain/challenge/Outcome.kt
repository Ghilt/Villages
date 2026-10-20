package villages.domain.challenge

import villages.domain.Resource

/** How a challenge ended. */
enum class Ending { PULLED, TIME_RAN_OUT }

/**
 * What a challenge came to: the [tug] toward side A, how it [ended] and in which [second], who won - the side the
 * tug ended toward, nobody at nought - and what each side gained and lost.
 */
data class Outcome(
    val tug: Double,
    val ended: Ending,
    val second: Int,
    val wonBy: Side?,
    val gains: List<Gain>,
    val losses: List<Loss>,
) {
    /** The tug toward [side]: `+10 toward House Varga`. */
    fun toward(side: Side): Double = if (side == Side.A) tug else -tug
}

/** Something a side gained by winning, through one of its effects: Sanctuary's piety. */
data class Gain(val side: Side, val resource: Resource, val amount: Double, val effect: String)

/** A building damaged or a person fatigued, killed on the line: [effectiveness] out of a hundred lost. */
data class Loss(val side: Side, val name: String, val fits: Fits, val effectiveness: Double, val effect: String)

/** A challenge fought: the [seed] it was fought from, every moment of it, and what it came to. */
data class ChallengeResult(val seed: Long, val moments: List<ChallengeMoment>, val outcome: Outcome)
