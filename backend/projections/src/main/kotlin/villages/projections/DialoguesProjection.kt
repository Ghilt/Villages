package villages.projections

import villages.application.DialogueEnding
import villages.application.DialogueRow
import villages.application.DialoguesByHouse
import villages.application.DialoguesChange
import villages.application.EventFeed
import villages.application.Start
import villages.application.StoredEvent
import villages.domain.CharacterEvent
import villages.domain.DialogueId
import villages.domain.HouseFounded
import villages.domain.HouseGainedKeyFigure
import villages.domain.HouseGainedVision
import villages.domain.HouseId
import villages.domain.HouseLostKeyFigure
import villages.domain.HouseLostVision
import villages.domain.HouseResourceGranted
import villages.domain.HouseResourcePledged
import villages.domain.HouseResourceReleased
import villages.domain.HouseResourceSpent
import villages.domain.PlayerCompletedDialogue
import villages.domain.PlayerCompletedDialogueStep
import villages.domain.PlayerGivenChoice
import villages.domain.PlayerId
import villages.domain.PlayerLostDialogue
import villages.domain.PlayerOfferedDialogue
import villages.domain.PlayerTookAction
import villages.domain.walk
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Every dialogue each house has been offered, open and finished, folded from the event feed.
 *
 * A row holds the dialogue whole and the steps taken through it, and nothing worked out from them: where a
 * dialogue has got to is the walk's to say, and the gateway walks it when it builds what the player is sent,
 * holding back what has not been reached. So this can never be a moment ahead of the house's rules, only a
 * moment behind them, which a revision on each row lets a page tell apart. See decision record 0067.
 *
 * Disposable, like every read model: delete it, replay the feed, get it back.
 */
class DialoguesProjection(feed: EventFeed) : DialoguesByHouse, AutoCloseable {
    private val byHouse = ConcurrentHashMap<HouseId, List<DialogueRow>>()
    private val listeners = CopyOnWriteArraySet<(DialoguesChange) -> Unit>()

    // From the beginning: a read model is its fold of every event. See decision record 0029.
    private val subscription: AutoCloseable = feed.subscribe(Start.FROM_THE_BEGINNING, ::apply)

    /** Folds one stored event. Exhaustive over the event types, so a new one has to be placed. */
    internal fun apply(stored: StoredEvent) {
        when (val event = stored.event) {
            is PlayerOfferedDialogue -> change(event.houseId, event.player) { rows ->
                rows + DialogueRow(
                    house = event.houseId,
                    player = event.player,
                    dialogue = event.dialogue,
                    taken = emptyList(),
                    ending = DialogueEnding.Open,
                    correlationId = stored.correlationId,
                    revision = 1,
                )
            }

            is PlayerCompletedDialogueStep -> change(event.houseId, event.player) { rows ->
                rows.changing(event.dialogueId) { it.copy(taken = it.taken + event.lineId) }
            }

            is PlayerCompletedDialogue -> change(event.houseId, event.player) { rows ->
                rows.changing(event.dialogueId) { it.copy(ending = DialogueEnding.Completed) }
            }

            is PlayerLostDialogue -> change(event.houseId, event.player) { rows ->
                rows.changing(event.dialogueId) { it.copy(ending = DialogueEnding.Lost(event.because)) }
            }

            // What a house has, what it was asked, whom it holds and what it sees are other read models'.
            is HouseFounded, is HouseResourceGranted, is HouseResourceSpent, is HouseResourcePledged,
            is HouseResourceReleased, is PlayerGivenChoice, is PlayerTookAction, is HouseGainedKeyFigure,
            is HouseLostKeyFigure, is HouseGainedVision, is HouseLostVision,
            -> return

            // A dialogue is offered to a house; a character's own history says nothing about one.
            is CharacterEvent -> return
        }
    }

    private fun change(house: HouseId, player: PlayerId, how: (List<DialogueRow>) -> List<DialogueRow>) {
        val now = how(byHouse[house].orEmpty())
        byHouse[house] = now
        // The step on the line that ends a dialogue and the end are two events of one decision, and between them
        // the row is a dialogue still open with nothing left to read or choose, which the house's rules say
        // cannot be. Nobody is told until the end is written, which follows in the same decision. See 0067.
        if (now.any { it.ending == DialogueEnding.Open && it.dialogue.walk(it.taken).over }) {
            return
        }
        for (listener in listeners) {
            listener(DialoguesChange(house, player, now))
        }
    }

    /** The rows with one dialogue changed, and its revision raised, which is what every change to one does. */
    private fun List<DialogueRow>.changing(id: DialogueId, how: (DialogueRow) -> DialogueRow): List<DialogueRow> =
        map { row -> if (row.dialogue.id == id) how(row).copy(revision = row.revision + 1) else row }

    override fun of(house: HouseId): List<DialogueRow> = byHouse[house].orEmpty()

    override fun watch(listener: (DialoguesChange) -> Unit): AutoCloseable {
        listeners += listener
        return AutoCloseable { listeners -= listener }
    }

    /**
     * Forgets every dialogue, because the world they were offered in has been emptied. Watchers are not told:
     * every session is being finished in the same breath and will arrive anew. See decision record 0036.
     */
    fun reset() {
        byHouse.clear()
    }

    override fun close() {
        subscription.close()
    }
}
