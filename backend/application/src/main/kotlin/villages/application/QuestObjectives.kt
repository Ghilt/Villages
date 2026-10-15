package villages.application

import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.Location
import villages.domain.MarkObjectiveMet
import villages.domain.NodeId
import villages.domain.Objective
import villages.domain.ObjectiveNode
import villages.domain.PlayerCompletedQuest
import villages.domain.PlayerCompletedQuestNode
import villages.domain.PlayerLostQuest
import villages.domain.PlayerMetQuestObjective
import villages.domain.PlayerOfferedQuest
import villages.domain.Quest
import villages.domain.QuestId
import villages.domain.QuestProgress
import villages.domain.StructureChangedHands
import villages.domain.StructureId
import villages.domain.StructureRaised
import villages.domain.StructureRebuilt
import villages.domain.StructureRuined
import villages.domain.StructureType
import villages.domain.Where
import villages.domain.walk
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * The listener for objectives: when the world meets an objective of the node a quest stands at, the house is told,
 * and its own rules tick it. Today the world meets one kind, a structure of a type held, anywhere or on an island.
 *
 * It follows the feed from the beginning with a fold of its own, as every listener that acts on its own does: each
 * structure's type, place, holder and whether it stands, and each house's open quests with what it recorded of them.
 * It acts only once it has caught up, because the past already holds the ticks it set off, and then sets right what
 * its whole fold says is met and unticked. After that it asks two things: when a structure comes to a house - raised
 * for it, handed to it, rebuilt for it - whether a quest of that house stands at an objective it meets; and when a
 * quest reaches a checklist, whether the house holds what it asks already. See decision record 0096.
 *
 * A tick continues the story of the event that met it. It issues through `Later` and cancels nothing: a tick the
 * house has already, or one for a node the quest has moved past, is refused, and those refusals mean "already done".
 * A new kind of objective the world meets is one more branch of [meets], and nothing else here changes.
 */
class QuestObjectives(
    feed: EventFeed,
    later: Later,
    faults: Faults,
    gate: WipeGate,
    private val houses: HouseCommandExecutor,
    private val clock: Clock,
    private val world: WorldClock,
    private val islands: Islands,
) : Reaction("the listener for objectives", feed, later, faults, gate) {
    private class Standing(val type: StructureType, val place: Location, val holder: HouseId?, val ruin: Boolean)

    private class Open(val house: HouseId, val quest: Quest, val progress: List<QuestProgress>)

    private val structures = ConcurrentHashMap<StructureId, Standing>()
    private val quests = ConcurrentHashMap<QuestId, Open>()

    @Volatile
    private var live = false

    override fun apply(stored: StoredEvent) {
        when (val event = stored.event) {
            is StructureRaised -> held(event.structureId, Standing(event.structureType, event.place, event.holder, ruin = false), stored)
            is StructureRebuilt -> structures[event.structureId]?.let {
                held(event.structureId, Standing(event.structureType, it.place, event.holder, ruin = false), stored)
            }
            is StructureChangedHands -> structures[event.structureId]?.let {
                held(event.structureId, Standing(it.type, it.place, event.to, it.ruin), stored)
            }
            is StructureRuined -> structures.computeIfPresent(event.structureId) { _, it -> Standing(it.type, it.place, null, ruin = true) }

            is PlayerOfferedQuest -> {
                quests[event.quest.id] = Open(event.houseId, event.quest, emptyList())
                reached(event.quest.id, stored)
            }
            is PlayerMetQuestObjective -> progressed(event.questId, QuestProgress.Ticked(event.nodeId, event.objectiveId))
            is PlayerCompletedQuestNode -> {
                progressed(event.questId, QuestProgress.Moved(event.nodeId, event.onto))
                reached(event.questId, stored)
            }
            is PlayerCompletedQuest -> quests.remove(event.questId)
            is PlayerLostQuest -> quests.remove(event.questId)
            else -> Unit
        }
    }

    /** Sets right what the whole history says the world has met and the house has not ticked, once, as it goes live. */
    override fun caughtUp() {
        live = true
        for (id in quests.keys) ask(id, because = null)
    }

    private fun held(id: StructureId, standing: Standing, because: StoredEvent) {
        structures[id] = standing
        val house = standing.holder ?: return
        if (live) quests.filterValues { it.house == house }.keys.forEach { ask(it, because) }
    }

    private fun progressed(id: QuestId, step: QuestProgress) {
        quests.computeIfPresent(id) { _, it -> Open(it.house, it.quest, it.progress + step) }
    }

    private fun reached(id: QuestId, because: StoredEvent) {
        if (live) ask(id, because)
    }

    /** Ticks every objective the world has met at the checklist the quest stands at, which the house has not ticked. */
    private fun ask(id: QuestId, because: StoredEvent?) {
        val open = quests[id] ?: return
        val walk = open.quest.walk(open.progress)
        val at = walk.at ?: return
        val checklist = open.quest.node(at) as? ObjectiveNode ?: return
        for (objective in checklist.objectives.filterIsInstance<Objective.MetByTheWorld>()) {
            if (objective.id !in walk.ticked && meets(open.house, objective)) tick(open.house, id, at, objective, because)
        }
    }

    /** Whether the world, as folded, meets an objective for a house: the one branch a new world-met kind adds. */
    private fun meets(house: HouseId, objective: Objective.MetByTheWorld): Boolean = when (objective) {
        is Objective.Hold -> structures.values.any { standing ->
            standing.holder == house && !standing.ruin && standing.type == objective.structureType &&
                when (objective.where) {
                    Where.Anywhere -> true
                    Where.Island -> islands.onAnIsland(standing.place)
                }
        }
    }

    private fun tick(house: HouseId, quest: QuestId, node: NodeId, objective: Objective, because: StoredEvent?) {
        val provenance = because?.let { Provenance.continuing(story = it, cause = it) } ?: Provenance.startedBy(UUID.randomUUID())
        issueLater(
            "ticking ${objective.id.value} of a quest of ${house.stream}",
            settled = setOf(
                HouseError.ObjectiveAlreadyMet::class,
                HouseError.NotTheCurrentNode::class,
                HouseError.QuestOver::class,
            ),
        ) {
            houses.execute(MarkObjectiveMet(house, quest, node, objective.id, world.today(), clock.now()), provenance)
        }
    }

    /** Forgets what it knew of, because the world it was in has been emptied. See decision 0036. */
    override fun forget() {
        structures.clear()
        quests.clear()
    }
}
