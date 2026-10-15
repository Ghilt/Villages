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

/**
 * One objective of the node the quest stood at was ticked. What meeting it cost - a delivery spent, a pledge tied -
 * follows as the world's own events from the same decision; one the world met is in the story of the event that met
 * it, and cost nothing. Once ticked it stays ticked. See decision record 0096.
 */
data class PlayerMetQuestObjective(
    override val houseId: HouseId,
    val player: PlayerId,
    val questId: QuestId,
    val nodeId: NodeId,
    val objectiveId: ObjectiveId,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : QuestEvent, PlayerEvent

/**
 * The quest moved past a node - its checklist ticked, its dialogue finished, its reward collected - along the edge
 * to `onto`, or to its end when `onto` is none. What the node gives, and what the next one does on arrival, follow
 * from the same decision. `onto` is carried so that a quest's road is read from its own events alone, as a choice's
 * is from the action taken. See decision record 0096.
 */
data class PlayerCompletedQuestNode(
    override val houseId: HouseId,
    val player: PlayerId,
    val questId: QuestId,
    val nodeId: NodeId,
    val onto: NodeId?,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : QuestEvent, PlayerEvent

/**
 * The quest's last node was done: written in the same decision, after it. Its own event, as a dialogue's end is,
 * so that nothing waiting on a quest's end has to look inside a move. The quest is no longer open. See decision
 * record 0096.
 */
data class PlayerCompletedQuest(
    override val houseId: HouseId,
    val player: PlayerId,
    val questId: QuestId,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : QuestEvent, PlayerEvent

/**
 * The house lost the way to a node of a quest: the road taken does not lead there, so it can never be reached. What
 * the player sees crossed out. One for every node a move cut off, drawn or not, right after the move that took the
 * other road, in the same decision. Its own event, as a dialogue's end is, so that nothing waiting on a lost node has
 * to work it out from the graph; a later cause of loss writes the same event. See decision record 0096.
 */
data class PlayerLostQuestNode(
    override val houseId: HouseId,
    val player: PlayerId,
    val questId: QuestId,
    val nodeId: NodeId,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : QuestEvent, PlayerEvent

/**
 * A quest lapsed: the dialogue of the node it stood at was lost, and `because` is that dialogue's failed
 * requirement, the one thing about it the player learns. It ends where it stood and is no longer open. Its own event
 * rather than an end with a reason, so that nothing waiting on an end takes a loss for one. See decision record 0096.
 */
data class PlayerLostQuest(
    override val houseId: HouseId,
    val player: PlayerId,
    val questId: QuestId,
    val because: Requirement,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : QuestEvent, PlayerEvent
