package villages.domain

import java.time.Instant

/**
 * What a house set out to do: the quests it was offered and has not finished, each with what it recorded of it,
 * and every one it was ever offered. The part of a founded house that decides its quest commands and folds its
 * quest events. What a node does to the rest of the house - a dialogue offered, a cost paid, a reward given - it
 * asks of the house, through [Follow], and never does itself. See decision records 0075 and 0096.
 */
data class Quests(
    /** The quests offered and not finished, in the order they were offered. A finished one leaves the list. */
    val open: List<OpenQuest> = emptyList(),
    /** Every quest ever offered, open or over, so that the same offer twice is refused. */
    val offered: Set<QuestId> = emptySet(),
) {
    internal fun decide(command: QuestCommand, player: PlayerId, follow: Follow): List<HouseEvent> = when (command) {
        // Several can be open at once, and the quest has checked itself already, so what is left to the house is
        // that it exists and has not been offered this one before. Its first node is reached at once.
        is OfferQuest -> {
            if (command.quest.id in offered) {
                throw HouseError.QuestAlreadyOffered
            }
            listOf(PlayerOfferedQuest(command.houseId, player, command.quest, command.worldTime, command.recordedAt)) +
                follow.follow(arriving(command.quest.start()), player, command.worldTime, command.recordedAt)
        }

        // The tick, what it costs and, on the last objective, the move on come out of one decision, as a dialogue's
        // step and what its line gives do, so a cost is never paid without its tick nor a tick seen without its cost.
        is MeetObjective -> {
            val (quest, objective) = ticking(command.questId, command.nodeId, command.objectiveId)
            if (objective !is Objective.MetByThePlayer) throw HouseError.NotThePlayersToMeet
            val cost = when (objective) {
                is Objective.Deliver -> Effect.Spend(objective.resource, objective.amount)
                is Objective.Pledge -> {
                    val pledging = command.pledging
                        ?: throw HouseError.InvalidPledge("a pledge objective is met with the id and the day of its pledge")
                    Effect.Pledge(pledging.pledgeId, objective.resource, objective.amount, pledging.until, quest.quest.title)
                }
            }
            val tick = PlayerMetQuestObjective(
                command.houseId, player, quest.quest.id, command.nodeId, objective.id, command.worldTime, command.recordedAt,
            )
            listOf(tick) + follow.follow(listOf(cost), player, command.worldTime, command.recordedAt) +
                movingOnIfTicked(quest, objective.id, player, follow, command.houseId, command.worldTime, command.recordedAt)
        }

        // What the world met costs nothing, and is ticked in the story of whatever met it.
        is MarkObjectiveMet -> {
            val (quest, objective) = ticking(command.questId, command.nodeId, command.objectiveId)
            if (objective !is Objective.MetByTheWorld) throw HouseError.NotTheWorldsToMeet
            val tick = PlayerMetQuestObjective(
                command.houseId, player, quest.quest.id, command.nodeId, objective.id, command.worldTime, command.recordedAt,
            )
            listOf(tick) + movingOnIfTicked(quest, objective.id, player, follow, command.houseId, command.worldTime, command.recordedAt)
        }

        // Collecting is the move past the reward, and what it gives follows the move, as what a line gives follows
        // its step.
        is CollectReward -> {
            val quest = standingAt(command.questId, command.nodeId)
            val reward = quest.quest.node(command.nodeId) as? RewardNode ?: throw HouseError.NotAReward
            movingOn(quest, reward, reward.gives, player, follow, command.houseId, command.worldTime, command.recordedAt)
        }
    }

    internal fun evolve(event: QuestEvent): Quests = when (event) {
        is PlayerOfferedQuest -> copy(open = open + OpenQuest(event.quest), offered = offered + event.quest.id)
        is PlayerMetQuestObjective -> progressed(event.questId, QuestProgress.Ticked(event.nodeId, event.objectiveId))
        is PlayerCompletedQuestNode -> progressed(event.questId, QuestProgress.Moved(event.nodeId, event.onto))
        // A quest that has ended is no longer open, and its id stays among those offered, so a move in it is
        // refused as over rather than as unknown.
        is PlayerCompletedQuest -> copy(open = open.filterNot { it.quest.id == event.questId })
    }

    private fun progressed(id: QuestId, step: QuestProgress): Quests =
        copy(open = open.map { if (it.quest.id == id) it.copy(progress = it.progress + step) else it })

    /** The open quest, standing at this node, or the refusal saying why not. */
    private fun standingAt(id: QuestId, node: NodeId): OpenQuest {
        val quest = open.firstOrNull { it.quest.id == id }
            ?: throw if (id in offered) HouseError.QuestOver else HouseError.NoSuchQuest
        if (quest.walk().at != node) throw HouseError.NotTheCurrentNode
        return quest
    }

    /** The open quest and the objective at the node it stands at, not yet ticked, or the refusal saying why not. */
    private fun ticking(id: QuestId, node: NodeId, objectiveId: ObjectiveId): Pair<OpenQuest, Objective> {
        val quest = standingAt(id, node)
        val checklist = quest.quest.node(node) as? ObjectiveNode ?: throw HouseError.NoSuchObjective
        val objective = checklist.objectives.firstOrNull { it.id == objectiveId } ?: throw HouseError.NoSuchObjective
        if (objectiveId in quest.walk().ticked) throw HouseError.ObjectiveAlreadyMet
        return quest to objective
    }

    /** The move past the node the quest stands at, when this tick was the last its checklist wanted. */
    @Suppress("LongParameterList")
    private fun movingOnIfTicked(
        quest: OpenQuest,
        ticked: ObjectiveId,
        player: PlayerId,
        follow: Follow,
        houseId: HouseId,
        worldTime: WorldTime,
        recordedAt: Instant,
    ): List<HouseEvent> {
        val walk = quest.walk()
        val checklist = quest.quest.node(walk.at!!) as ObjectiveNode
        if (checklist.objectives.map { it.id }.toSet() != walk.ticked + ticked) return emptyList()
        return movingOn(quest, checklist, emptyList(), player, follow, houseId, worldTime, recordedAt)
    }

    /**
     * The quest moving past a node along its one edge, or to its end: the move, what the node gives, what the next
     * node does on arrival, and the end when there is no next, decided in that order against the house as each left it.
     */
    @Suppress("LongParameterList")
    private fun movingOn(
        quest: OpenQuest,
        from: QuestNode,
        gives: List<Effect>,
        player: PlayerId,
        follow: Follow,
        houseId: HouseId,
        worldTime: WorldTime,
        recordedAt: Instant,
    ): List<HouseEvent> {
        val next = from.edges.singleOrNull()?.let { quest.quest.node(it.to) }
        val ends = listOfNotNull(
            PlayerCompletedQuest(houseId, player, quest.quest.id, worldTime, recordedAt).takeIf { next == null },
        )
        return listOf(PlayerCompletedQuestNode(houseId, player, quest.quest.id, from.id, next?.id, worldTime, recordedAt)) +
            follow.follow(gives + next?.let(::arriving).orEmpty(), player, worldTime, recordedAt) + ends
    }
}

/**
 * What reaching a node does to the house, as effects: a dialogue node offers its dialogue, and an objective or a
 * reward node does nothing until it is met or collected.
 */
internal fun arriving(node: QuestNode): List<Effect> = when (node) {
    is DialogueNode -> listOf(Effect.Converse(node.dialogue))
    is ObjectiveNode, is RewardNode -> emptyList()
}

/**
 * A quest a house has open, and what it recorded of it so far, in order: all it needs to know where the quest
 * stands.
 */
data class OpenQuest(
    val quest: Quest,
    val progress: List<QuestProgress> = emptyList(),
) {
    /** Where it has got to. */
    fun walk(): QuestWalk = quest.walk(progress)
}
