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
            val at = Moment(command.houseId, player, command.worldTime, command.recordedAt)
            listOf(PlayerOfferedQuest(at.house, player, command.quest, at.worldTime, at.recordedAt)) +
                at.following(follow, arriving(command.quest.start()))
        }

        // The tick, what it costs and, on the last objective, the move on come out of one decision, as a dialogue's
        // step and what its line gives do, so a cost is never paid without its tick nor a tick seen without its cost.
        is MeetObjective -> {
            val at = Moment(command.houseId, player, command.worldTime, command.recordedAt)
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
            listOf(at.ticked(quest, objective)) + at.following(follow, listOf(cost)) + movingOnIfTicked(quest, objective, at, follow)
        }

        // What the world met costs nothing, and is ticked in the story of whatever met it.
        is MarkObjectiveMet -> {
            val at = Moment(command.houseId, player, command.worldTime, command.recordedAt)
            val (quest, objective) = ticking(command.questId, command.nodeId, command.objectiveId)
            if (objective !is Objective.MetByTheWorld) throw HouseError.NotTheWorldsToMeet
            listOf(at.ticked(quest, objective)) + movingOnIfTicked(quest, objective, at, follow)
        }

        // Collecting is the move past the reward, and what it gives follows the move, as what a line gives follows
        // its step.
        is CollectReward -> {
            val at = Moment(command.houseId, player, command.worldTime, command.recordedAt)
            val quest = standingAt(command.questId, command.nodeId)
            val reward = quest.quest.node(command.nodeId) as? RewardNode ?: throw HouseError.NotAReward
            movingOn(quest, reward, reward.edges.singleOrNull()?.to, reward.gives, at, follow)
        }
    }

    /**
     * What the quests answer to what a dialogue command wrote: a dialogue that ended at the node a quest stands at
     * moves the quest along the edge its ending leads along, and one that lapsed there loses the quest, for the same
     * reason. A dialogue that is no quest's is answered with nothing. Decided with the dialogue's events, so the end
     * and the move are one append.
     */
    internal fun answering(told: List<HouseEvent>, player: PlayerId, follow: Follow): List<HouseEvent> = told.flatMap { event ->
        when (event) {
            is PlayerCompletedDialogue -> waitingOn(event.dialogueId)?.let { (quest, node) ->
                val at = Moment(event.houseId, player, event.worldTime, event.recordedAt)
                val ending = told.filterIsInstance<PlayerCompletedDialogueStep>().last { it.dialogueId == event.dialogueId }
                val edge = node.edges.firstOrNull { ending.lineId in it.endings } ?: node.edges.singleOrNull()
                movingOn(quest, node, edge?.to, emptyList(), at, follow)
            }.orEmpty()
            is PlayerLostDialogue -> waitingOn(event.dialogueId)?.let { (quest, _) ->
                listOf(PlayerLostQuest(event.houseId, player, quest.quest.id, event.because, event.worldTime, event.recordedAt))
            }.orEmpty()
            else -> emptyList()
        }
    }

    internal fun evolve(event: QuestEvent): Quests = when (event) {
        is PlayerOfferedQuest -> copy(open = open + OpenQuest(event.quest), offered = offered + event.quest.id)
        is PlayerMetQuestObjective -> progressed(event.questId, QuestProgress.Ticked(event.nodeId, event.objectiveId))
        is PlayerCompletedQuestNode -> progressed(event.questId, QuestProgress.Moved(event.nodeId, event.onto))
        // What is lost is worked out by the walk from the moves; the event is for whatever waits on a lost node.
        is PlayerLostQuestNode -> this
        // A quest that has ended, finished or lost, is no longer open, and its id stays among those offered, so a
        // move in it is refused as over rather than as unknown.
        is PlayerCompletedQuest -> copy(open = open.filterNot { it.quest.id == event.questId })
        is PlayerLostQuest -> copy(open = open.filterNot { it.quest.id == event.questId })
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

    /** The open quest standing at the dialogue node whose dialogue this is, if any quest is. */
    private fun waitingOn(dialogue: DialogueId): Pair<OpenQuest, DialogueNode>? = open.firstNotNullOfOrNull { quest ->
        val at = quest.walk().at?.let(quest.quest::node) as? DialogueNode
        if (at?.dialogue?.id == dialogue) quest to at else null
    }

    /** The move past the node the quest stands at, when this tick was the last its checklist wanted. */
    private fun movingOnIfTicked(quest: OpenQuest, ticked: Objective, at: Moment, follow: Follow): List<HouseEvent> {
        val walk = quest.walk()
        val checklist = quest.quest.node(walk.at!!) as ObjectiveNode
        if (checklist.objectives.map { it.id }.toSet() != walk.ticked + ticked.id) return emptyList()
        return movingOn(quest, checklist, checklist.edges.singleOrNull()?.to, emptyList(), at, follow)
    }

    /**
     * The quest moving past a node onto the next, or to its end: the move, every node it cut off, what the node gives,
     * what the next node does on arrival, and the end when there is no next, decided in that order against the house
     * as each left it.
     */
    @Suppress("LongParameterList")
    private fun movingOn(
        quest: OpenQuest,
        from: QuestNode,
        onto: NodeId?,
        gives: List<Effect>,
        at: Moment,
        follow: Follow,
    ): List<HouseEvent> {
        val id = quest.quest.id
        val next = onto?.let(quest.quest::node)
        val lost = quest.quest.cutOffBy(from.id, onto).map { node ->
            PlayerLostQuestNode(at.house, at.player, id, node, at.worldTime, at.recordedAt)
        }
        val ends = listOfNotNull(PlayerCompletedQuest(at.house, at.player, id, at.worldTime, at.recordedAt).takeIf { next == null })
        return listOf(PlayerCompletedQuestNode(at.house, at.player, id, from.id, onto, at.worldTime, at.recordedAt)) + lost +
            at.following(follow, gives + next?.let(::arriving).orEmpty()) + ends
    }
}

/** Whose decision it is and when: what every event a quest writes carries. */
private data class Moment(val house: HouseId, val player: PlayerId, val worldTime: WorldTime, val recordedAt: Instant) {
    fun ticked(quest: OpenQuest, objective: Objective) =
        PlayerMetQuestObjective(house, player, quest.quest.id, quest.walk().at!!, objective.id, worldTime, recordedAt)

    fun following(follow: Follow, effects: List<Effect>): List<HouseEvent> = follow.follow(effects, player, worldTime, recordedAt)
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
