package villages.domain

import java.time.Instant

/**
 * A player was offered a quest. The whole of it is here - every node with what it is and how it is shown, every
 * edge, objective and reward, and every dialogue inside it - so the roads not taken are history too, and every
 * later move is checked against this event alone. Its first node is reached from the same decision: a dialogue
 * node's dialogue is offered right after it. Several can be open at once.
 *
 * Nothing happened in the world when this was written: a story was put to the house. See decision record 0096.
 */
data class PlayerOfferedQuest(
    override val houseId: HouseId,
    val player: PlayerId,
    val quest: Quest,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : QuestEvent, PlayerEvent
