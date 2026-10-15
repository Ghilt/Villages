package villages.application

import villages.domain.HouseId
import villages.domain.PlayerId
import villages.domain.Quest
import villages.domain.QuestProgress
import villages.domain.Requirement

/**
 * A quest as the read model holds it, for the player it was offered to: the whole of it, what the house recorded of
 * it, how it stands, and the story it was offered in. Where it stands and what is drawn are the walk's to say, from
 * the quest and the progress, so nothing here can come to disagree with the decider. See decision record 0096.
 */
data class QuestRow(
    val house: HouseId,
    val player: PlayerId,
    val quest: Quest,
    /** What the house recorded of it, in order: the objectives ticked and the moves made. */
    val progress: List<QuestProgress>,
    val ending: QuestEnding,
    /** The story it was offered in, which a move in it continues rather than starting one. See 0035. */
    val correlationId: String,
    /** The read model's own count for this quest, which rises with every change to it. */
    val revision: Long,
)

/** How a quest stands: open, finished, or lost because a dialogue in it lapsed. */
sealed interface QuestEnding {
    data object Open : QuestEnding

    data object Completed : QuestEnding

    /** Ended unfinished, because the dialogue of the node it stood at lost this requirement. See 0096. */
    data class Lost(val because: Requirement) : QuestEnding
}

/** A house's quests as they now stand, for the player whose house it is. */
data class QuestsChange(val house: HouseId, val player: PlayerId, val quests: List<QuestRow>)

/**
 * Every quest each house has been offered, open and finished, in the order it was offered them. What a player is
 * sent of each is the gateway's to decide, and it holds back what is not drawn. See decision record 0096.
 */
interface QuestsByHouse {
    fun of(house: HouseId): List<QuestRow>

    /** Every change to a house's quests, until closed: one offered, an objective ticked, a move, or one ended. */
    fun watch(listener: (QuestsChange) -> Unit): AutoCloseable
}
