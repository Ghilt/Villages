package villages.domain

import java.time.Instant

/**
 * Offer this house a quest, whole. Refused for a house that does not exist, and for a quest it was offered before:
 * the id is worked out from the command that offered it, so the same command sent twice is refused rather than
 * doubled. Its first node is reached from the same decision. See decision record 0096.
 */
data class OfferQuest(
    override val houseId: HouseId,
    val quest: Quest,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : QuestCommand

/**
 * Meet one objective of the node the quest stands at, by the player's own press: a delivery is spent, a pledge is
 * tied, and the objective is ticked, all from one decision; the last one moves the quest on. Refused for an
 * objective only the world can meet. A pledge's id and day come with it, worked out before the decision, because
 * the calendar is not the domain's; nothing else needs them. See decision record 0096.
 */
data class MeetObjective(
    override val houseId: HouseId,
    val questId: QuestId,
    val nodeId: NodeId,
    val objectiveId: ObjectiveId,
    val worldTime: WorldTime,
    val recordedAt: Instant,
    val pledging: Pledging? = null,
) : QuestCommand

/** The id and the day of the pledge a quest's pledge objective makes when it is met. */
data class Pledging(val pledgeId: PledgeId, val until: WorldTime)

/**
 * Tick an objective the world met - a structure held, say - at the node the quest stands at, and move the quest on
 * when it was the last. Sent by the listener for objectives, never by a player, and refused for an objective the
 * player's own press must meet, because that press is what pays for it. See decision record 0096.
 */
data class MarkObjectiveMet(
    override val houseId: HouseId,
    val questId: QuestId,
    val nodeId: NodeId,
    val objectiveId: ObjectiveId,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : QuestCommand

/**
 * Collect the reward the quest stands at: the quest moves past it, what it gives follows, and the quest is
 * completed when it was the last node. See decision record 0096.
 */
data class CollectReward(
    override val houseId: HouseId,
    val questId: QuestId,
    val nodeId: NodeId,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : QuestCommand
