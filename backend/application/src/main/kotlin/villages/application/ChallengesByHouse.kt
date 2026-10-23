package villages.application

import villages.domain.ChallengeId
import villages.domain.HouseId
import villages.domain.NodeId
import villages.domain.Opponent
import villages.domain.PlayerId
import villages.domain.QuestId
import villages.domain.challenge.ChallengeSetup
import villages.domain.challenge.Outcome
import java.time.Instant

/**
 * A challenge a house fought, as the history holds it, for the player whose house it is: who stood against whom, what
 * raised it, what each side brought and its progression, the seed and the catalogue and engine it was fought under, what
 * it came to, when, and where the quest went on to. Everything a replay needs to fight it again, and everything the
 * history says of it. See decision record 0107, amended.
 */
data class ChallengeRow(
    val house: HouseId,
    val player: PlayerId,
    val id: ChallengeId,
    val questId: QuestId,
    val questTitle: String,
    val nodeId: NodeId,
    /** The challenge node's title: what the challenge is called. */
    val title: String,
    val kind: String,
    /** The house's name as it was when it fought. */
    val houseName: String,
    val against: Opponent,
    val brought: List<String>,
    val setup: ChallengeSetup,
    val seed: Long,
    val catalogue: String,
    val engine: Int,
    val outcome: Outcome,
    val foughtAt: Instant,
    /** The title of the node the quest went on to, none until the move is heard, and none when it was the end. */
    val then: String? = null,
    /** The read model's own count for this challenge, which rises with every change to it. */
    val revision: Long = 1,
)

/** A house's challenges as they now stand, for the player whose house it is. */
data class ChallengesChange(val house: HouseId, val player: PlayerId, val challenges: List<ChallengeRow>)

/**
 * Every challenge each house has fought, in the order it fought them: the history its player is sent, and what a
 * replay is fought again from. See decision record 0107, amended.
 */
interface ChallengesByHouse {
    fun of(house: HouseId): List<ChallengeRow>

    /** Every change to a house's challenges, until closed: one fought, or the road its quest took heard. */
    fun watch(listener: (ChallengesChange) -> Unit): AutoCloseable
}
