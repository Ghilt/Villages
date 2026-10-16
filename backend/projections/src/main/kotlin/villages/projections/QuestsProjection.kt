package villages.projections

import villages.application.EventFeed
import villages.application.Follower
import villages.application.QuestEnding
import villages.application.QuestRow
import villages.application.QuestsByHouse
import villages.application.QuestsChange
import villages.application.StoredEvent
import villages.domain.CharacterEvent
import villages.domain.ChoiceEvent
import villages.domain.DialogueEvent
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.KeyFigureEvent
import villages.domain.PlayerCompletedQuest
import villages.domain.PlayerCompletedQuestNode
import villages.domain.PlayerId
import villages.domain.PlayerLostQuest
import villages.domain.PlayerLostQuestNode
import villages.domain.PlayerMetQuestObjective
import villages.domain.PlayerOfferedQuest
import villages.domain.QuestId
import villages.domain.QuestProgress
import villages.domain.ResourceEvent
import villages.domain.SeatEvent
import villages.domain.StructureEvent
import villages.domain.WorldStreamEvent
import villages.domain.VisionEvent
import villages.domain.walk
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Every quest each house has been offered, open and finished, folded from the event feed.
 *
 * A row holds the quest whole and what the house recorded of it, and nothing worked out from them: where a quest
 * stands and what is drawn are the walk's to say, and the gateway walks it when it builds what the player is sent,
 * holding back what is not drawn. So this can never be a moment ahead of the house's rules, only behind them, which
 * a revision on each row lets a page tell apart. See decision record 0096.
 *
 * Disposable, like every read model: delete it, replay the feed, get it back.
 */
class QuestsProjection(feed: EventFeed) : Follower(feed), QuestsByHouse {
    private val byHouse = ConcurrentHashMap<HouseId, List<QuestRow>>()
    private val listeners = CopyOnWriteArraySet<(QuestsChange) -> Unit>()

    /** Folds one stored event. Exhaustive over the event types, so a new one has to be placed. */
    override fun apply(stored: StoredEvent) {
        when (val event = stored.event) {
            is PlayerOfferedQuest -> change(event.houseId, event.player) { rows ->
                rows + QuestRow(
                    house = event.houseId,
                    player = event.player,
                    quest = event.quest,
                    progress = emptyList(),
                    ending = QuestEnding.Open,
                    correlationId = stored.correlationId,
                    revision = 1,
                )
            }

            is PlayerMetQuestObjective -> change(event.houseId, event.player) { rows ->
                rows.progressed(event.questId, QuestProgress.Ticked(event.nodeId, event.objectiveId))
            }

            is PlayerCompletedQuestNode -> change(event.houseId, event.player) { rows ->
                rows.progressed(event.questId, QuestProgress.Moved(event.nodeId, event.onto))
            }

            // What is lost the walk works out from the move before it, written in the same decision; nothing changes.
            is PlayerLostQuestNode -> return

            is PlayerCompletedQuest -> change(event.houseId, event.player) { rows ->
                rows.changing(event.questId) { it.copy(ending = QuestEnding.Completed) }
            }

            is PlayerLostQuest -> change(event.houseId, event.player) { rows ->
                rows.changing(event.questId) { it.copy(ending = QuestEnding.Lost(event.because)) }
            }

            // What a house has, what it was asked and told, whom it holds and what it sees are other read models'.
            is HouseFounded, is ResourceEvent, is ChoiceEvent, is DialogueEvent, is KeyFigureEvent, is VisionEvent,
            is SeatEvent -> return

            // A quest is offered to a house; a character's or a structure's own history says nothing about one.
            is CharacterEvent -> return
            is StructureEvent -> return
            // What the world takes on from its catalogues is read by no read model. See decision record 0097.
            is WorldStreamEvent -> return
        }
    }

    private fun change(house: HouseId, player: PlayerId, how: (List<QuestRow>) -> List<QuestRow>) {
        val now = how(byHouse[house].orEmpty())
        byHouse[house] = now
        // The move past a quest's last node and its end are two events of one decision, and between them the row is
        // a quest still open with nowhere left to stand, which the house's rules say cannot be. Nobody is told until
        // the end is written, which follows in the same decision.
        if (now.any { it.ending == QuestEnding.Open && it.quest.walk(it.progress).over }) {
            return
        }
        for (listener in listeners) {
            listener(QuestsChange(house, player, now))
        }
    }

    private fun List<QuestRow>.progressed(id: QuestId, step: QuestProgress): List<QuestRow> =
        changing(id) { it.copy(progress = it.progress + step) }

    /** The rows with one quest changed, and its revision raised, which is what every change to one does. */
    private fun List<QuestRow>.changing(id: QuestId, how: (QuestRow) -> QuestRow): List<QuestRow> =
        map { row -> if (row.quest.id == id) how(row).copy(revision = row.revision + 1) else row }

    override fun of(house: HouseId): List<QuestRow> = byHouse[house].orEmpty()

    override fun watch(listener: (QuestsChange) -> Unit): AutoCloseable {
        listeners += listener
        return AutoCloseable { listeners -= listener }
    }

    /**
     * Forgets every quest, because the world they were offered in has been emptied. Watchers are not told: every
     * session is being finished in the same breath and will arrive anew. See decision record 0036.
     */
    override fun reset() {
        byHouse.clear()
    }
}
