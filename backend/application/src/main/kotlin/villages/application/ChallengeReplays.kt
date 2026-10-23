package villages.application

import villages.domain.ChallengeId
import villages.domain.HouseId
import villages.domain.challenge.Challenge
import villages.domain.challenge.ChallengeResult

/**
 * A challenge a house fought, fought again to be watched: its moments are not kept, so the engine fights it again from
 * the setup and the seed the house recorded, on the catalogue and the rules in force. What it came to is the one
 * recorded, never this; when the catalogue or the engine has changed since and the fight comes out otherwise, the replay
 * says it differs, and when the catalogue no longer has what it was fought with, it cannot be fought again at all and
 * says that. Nothing is stored. See decision record 0107, amended.
 */
class ChallengeReplays(
    private val rows: ChallengesByHouse,
    /** The challenge catalogue and the balance in force: what the challenge is fought again on. See 0097. */
    private val catalogues: () -> Catalogues,
) {
    /** The challenge [challenge] of [house] fought again, or none when the house fought no such challenge. */
    fun replay(house: HouseId, challenge: ChallengeId): Replay? {
        val row = rows.of(house).firstOrNull { it.id == challenge } ?: return null
        val inForce = catalogues()
        if (row.setup.refusals(inForce.challenges).isNotEmpty()) return Replay(row, null, differs = true)
        val again = Challenge.resolve(row.setup, row.seed, inForce.challenges, inForce.balance.challenge)
        return Replay(row, again, differs = again.outcome != row.outcome)
    }
}

/**
 * A challenge fought again: the [row] the history holds of it, the fight [again] - none when the catalogue in force
 * cannot fight it - and whether it [differs] from what was recorded.
 */
data class Replay(val row: ChallengeRow, val again: ChallengeResult?, val differs: Boolean)
