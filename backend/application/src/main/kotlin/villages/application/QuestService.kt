package villages.application

import villages.domain.CollectReward
import villages.domain.HouseId
import villages.domain.MeetObjective
import villages.domain.NodeId
import villages.domain.Objective
import villages.domain.ObjectiveId
import villages.domain.ObjectiveNode
import villages.domain.OfferQuest
import villages.domain.PlayerId
import villages.domain.PledgeId
import villages.domain.Pledging
import villages.domain.QuestId

/**
 * Offering a house a quest, and playing it: an objective met by the player's own press, a reward collected.
 *
 * A thin seam, like every use case here: it works out which house from the player, stamps the two times, and hands
 * the command to the decider, where the rules are. The debug panel offers one of the quests on the shelf; the world
 * will offer through the same door. See decision records 0096 and 0097.
 */
class QuestService(
    private val executor: HouseCommandExecutor,
    private val clock: Clock,
    private val world: WorldClock,
    private val calendar: WorldCalendar,
    private val ids: FreshIds,
    private val quests: QuestsByHouse,
    /** Every quest there is to offer, and the dialogues they name: the catalogues in force. See 0097. */
    private val catalogues: () -> Catalogues,
) {
    /**
     * Offers the player's house the quest of this name on the shelf, and says which quest it turned out to be. The
     * quest's id is worked out from the command, so the same command sent twice is refused as already offered rather
     * than doubled, and a house that does not exist is refused `noSuchHouse`. A name that is no quest on the shelf is
     * refused as a malformed request rather than a refusal of the rules, because no rule was asked.
     */
    fun offer(player: PlayerId, name: String, provenance: Provenance): QuestId {
        val inForce = catalogues()
        val template = inForce.quests[name] ?: throw IllegalArgumentException("there is no quest called \"$name\" on the shelf")
        val house = HouseId.of(player)
        val id = QuestId.offered(house, provenance.commandId)
        executor.execute(OfferQuest(house, template.offered(id, house, inForce.dialogues), world.today(), clock.now()), provenance)
        return id
    }

    /**
     * Meets one objective of the node a quest stands at, by the player's press: a delivery is spent, a pledge tied.
     * For a pledge, its id is minted here and its day worked out from the months the objective asks, read off the
     * quest as the read model has it, as a pledge from the panel's are, because the calendar cannot cross into the
     * domain; the house uses them only for a pledge. Whether the objective is the player's to meet, and whether the
     * house can pay, is the house's to say. Which story it belongs to is the caller's, because it continues the quest's.
     */
    fun meet(player: PlayerId, quest: QuestId, node: NodeId, objective: ObjectiveId, provenance: Provenance) {
        val house = HouseId.of(player)
        val today = world.today()
        val asked = (quests.of(house).firstOrNull { it.quest.id == quest }?.quest?.node(node) as? ObjectiveNode)
            ?.objectives?.firstOrNull { it.id == objective }
        val pledging = (asked as? Objective.Pledge)?.let { Pledging(PledgeId(ids.fresh()), calendar.plusMonths(today, it.months.toLong())) }
        executor.execute(MeetObjective(house, quest, node, objective, today, clock.now(), pledging), provenance)
    }

    /** Collects the reward a quest stands at: refused for a node that is not one, or not where the quest stands. */
    fun collect(player: PlayerId, quest: QuestId, node: NodeId, provenance: Provenance) {
        executor.execute(CollectReward(HouseId.of(player), quest, node, world.today(), clock.now()), provenance)
    }
}
