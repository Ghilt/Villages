package villages.application

import villages.domain.Choice
import villages.domain.HouseId
import villages.domain.PlayerId

/**
 * The choice a player has to make, as the read model holds it. The correlation id is the story the choice
 * began, so an action answering it can be recorded as part of the same story rather than a new one.
 */
data class ChoiceRow(
    val player: PlayerId,
    val houseId: HouseId,
    val choice: Choice,
    val correlationId: String,
)

/**
 * What each player has been asked and has not yet answered. One pending choice a player, because a player
 * has one house and a house is asked one thing at a time. See decision record 0034.
 */
interface ChoicesByPlayer {
    fun pendingOf(player: PlayerId): ChoiceRow?

    /**
     * Every change to what a player has pending, until closed: the row when one is given, and null when it
     * is answered or settled.
     */
    fun watch(listener: (PlayerId, ChoiceRow?) -> Unit): AutoCloseable
}
