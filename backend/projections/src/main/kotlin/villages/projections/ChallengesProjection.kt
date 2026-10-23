package villages.projections

import villages.application.ChallengeRow
import villages.application.ChallengesByHouse
import villages.application.ChallengesChange
import villages.application.EventFeed
import villages.application.Follower
import villages.application.StoredEvent
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.PlayerCompletedQuestNode
import villages.domain.PlayerId
import villages.domain.PlayerOfferedQuest
import villages.domain.PlayerResolvedChallenge
import villages.domain.Quest
import villages.domain.QuestId
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Every challenge each house has fought, folded from the event feed: the history its player is sent, each row with
 * the house's name as it was, the quest and the node that raised it by their titles, and the road the quest took, heard
 * from the move written right after it in the same decision. The names and the quests are remembered from the events
 * that gave them, so a row never waits on another read model. See decision record 0107, amended.
 *
 * Disposable, like every read model: delete it, replay the feed, get it back.
 */
class ChallengesProjection(feed: EventFeed) : Follower(feed), ChallengesByHouse {
    private val byHouse = ConcurrentHashMap<HouseId, List<ChallengeRow>>()
    private val names = ConcurrentHashMap<HouseId, String>()
    private val quests = ConcurrentHashMap<QuestId, Quest>()
    private val listeners = CopyOnWriteArraySet<(ChallengesChange) -> Unit>()

    override fun apply(stored: StoredEvent) {
        when (val event = stored.event) {
            is HouseFounded -> names[event.houseId] = event.name.value
            is PlayerOfferedQuest -> quests[event.quest.id] = event.quest
            is PlayerResolvedChallenge -> change(event.houseId, event.player) { rows -> rows + rowOf(event) }
            is PlayerCompletedQuestNode -> {
                val waiting = byHouse[event.houseId].orEmpty().any { it.questId == event.questId && it.nodeId == event.nodeId && it.then == null }
                if (waiting) {
                    val onto = event.onto?.let { quests[event.questId]?.node(it)?.title } ?: THE_END
                    change(event.houseId, event.player) { rows ->
                        rows.map { row ->
                            if (row.questId == event.questId && row.nodeId == event.nodeId && row.then == null) {
                                row.copy(then = onto, revision = row.revision + 1)
                            } else {
                                row
                            }
                        }
                    }
                }
            }
            else -> Unit
        }
    }

    private fun rowOf(event: PlayerResolvedChallenge): ChallengeRow {
        val quest = quests[event.questId]
        return ChallengeRow(
            house = event.houseId,
            player = event.player,
            id = event.challengeId,
            questId = event.questId,
            questTitle = quest?.title ?: "a quest",
            nodeId = event.nodeId,
            title = quest?.node(event.nodeId)?.title ?: "a challenge",
            kind = event.kind,
            houseName = names[event.houseId] ?: "the house",
            against = event.against,
            brought = event.brought,
            setup = event.setup,
            seed = event.seed,
            catalogue = event.catalogue,
            engine = event.engine,
            outcome = event.outcome,
            foughtAt = event.recordedAt,
        )
    }

    private fun change(house: HouseId, player: PlayerId, how: (List<ChallengeRow>) -> List<ChallengeRow>) {
        val now = how(byHouse[house].orEmpty())
        byHouse[house] = now
        for (listener in listeners) {
            listener(ChallengesChange(house, player, now))
        }
    }

    override fun of(house: HouseId): List<ChallengeRow> = byHouse[house].orEmpty()

    override fun watch(listener: (ChallengesChange) -> Unit): AutoCloseable {
        listeners += listener
        return AutoCloseable { listeners -= listener }
    }

    /**
     * Forgets every challenge, every name and every quest, because the world they were fought in has been emptied.
     * Watchers are not told: every session is being finished in the same breath and will arrive anew. See 0036.
     */
    override fun reset() {
        byHouse.clear()
        names.clear()
        quests.clear()
    }

    companion object {
        /** What a row says the quest went on to when the challenge was its last node. */
        const val THE_END = "the end of the quest"
    }
}
