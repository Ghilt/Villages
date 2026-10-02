package villages.application

import villages.domain.Dialogue
import villages.domain.HouseId
import villages.domain.LineId
import villages.domain.PlayerId
import villages.domain.Requirement

/**
 * A dialogue as the read model holds it, for the player it was offered to: the whole of it, the steps taken
 * through it, how it stands, and the story it was offered in. Where it has got to is the walk's to say, from
 * the dialogue and the steps, so nothing here can come to disagree with the decider. See decision record 0071.
 */
data class DialogueRow(
    val house: HouseId,
    val player: PlayerId,
    val dialogue: Dialogue,
    /** The steps taken through it, in the order they were taken. */
    val taken: List<LineId>,
    val ending: DialogueEnding,
    /** The story it was offered in, which a step through it continues rather than starting one. See 0035. */
    val correlationId: String,
    /**
     * The read model's own count for this dialogue, which rises with every change to it: what a page keeps its
     * reading place by, holding its place while this holds.
     */
    val revision: Long,
)

/** How a dialogue stands: open, finished by reaching its end, or lost because a requirement failed. */
sealed interface DialogueEnding {
    data object Open : DialogueEnding

    data object Completed : DialogueEnding

    /** Ended unfinished, because this requirement failed. See decision record 0071. */
    data class Lost(val because: Requirement) : DialogueEnding
}

/** A house's dialogues as they now stand, for the player whose house it is. */
data class DialoguesChange(val house: HouseId, val player: PlayerId, val dialogues: List<DialogueRow>)

/**
 * Every dialogue each house has been offered, open and finished, in the order it was offered them. What a
 * player is sent of each is the gateway's to decide, and it holds back what has not been reached. See 0071.
 */
interface DialoguesByHouse {
    fun of(house: HouseId): List<DialogueRow>

    /** Every change to a house's dialogues, until closed: one offered, a step taken, or one finished. */
    fun watch(listener: (DialoguesChange) -> Unit): AutoCloseable
}
