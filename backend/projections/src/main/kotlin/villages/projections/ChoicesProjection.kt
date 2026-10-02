package villages.projections

import villages.application.ChoiceRow
import villages.application.ChoicesByPlayer
import villages.application.EventFeed
import villages.application.StoredEvent
import villages.application.Follower
import villages.domain.CharacterEvent
import villages.domain.HouseFounded
import villages.domain.PlayerGivenChoice
import villages.domain.PlayerTookAction
import villages.domain.PlayerId
import villages.domain.ResourceEvent
import villages.domain.DialogueEvent
import villages.domain.KeyFigureEvent
import villages.domain.VisionEvent
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet

/**
 * What each player has been asked and has not yet answered, folded from the event feed.
 *
 * One row a player, because a player has one house and a house is asked one thing at a time. A choice is
 * put on when it is given and taken off when it is answered or when a founding settles it, which is the
 * same rule `evolve` follows in the domain, read here off the events rather than the state.
 *
 * Disposable, like every read model: delete it, replay the feed, get it back.
 */
class ChoicesProjection(feed: EventFeed) : Follower(feed), ChoicesByPlayer {
    private val pending = ConcurrentHashMap<PlayerId, ChoiceRow>()
    private val listeners = CopyOnWriteArraySet<(PlayerId, ChoiceRow?) -> Unit>()

    /** Folds one stored event. Exhaustive over the event types, so a new one has to be placed. */
    override fun apply(stored: StoredEvent) {
        when (val event = stored.event) {
            is PlayerGivenChoice -> {
                val row = ChoiceRow(
                    player = event.player,
                    houseId = event.houseId,
                    choice = event.choice,
                    // The story the choice began. An action answering it continues that story rather
                    // than starting one, which is what makes a founding read as one thing. See 0035.
                    correlationId = stored.correlationId,
                )
                pending[event.player] = row
                tell(event.player, row)
            }

            is PlayerTookAction -> forget(event.player)

            // What a house has, whom it holds and what it sees are other read models' business. This one only
            // tracks what is pending.
            is ResourceEvent, is KeyFigureEvent, is VisionEvent -> return

            // Founding by any means settles the question of where to found, so whatever was pending goes.
            // The domain says the same thing in `evolve`; this is that rule read off the events.
            is HouseFounded -> forget(event.player)

            // A dialogue choice is not a choice put to the house, however alike the two are: nothing is pending.
            is DialogueEvent -> return

            // A choice is put to a house, never to a character.
            is CharacterEvent -> return
        }
    }

    private fun forget(player: PlayerId) {
        if (pending.remove(player) != null) {
            tell(player, null)
        }
    }

    private fun tell(player: PlayerId, row: ChoiceRow?) {
        for (listener in listeners) {
            listener(player, row)
        }
    }

    override fun pendingOf(player: PlayerId): ChoiceRow? = pending[player]

    override fun watch(listener: (PlayerId, ChoiceRow?) -> Unit): AutoCloseable {
        listeners += listener
        return AutoCloseable { listeners -= listener }
    }

    /** How many players have something to decide, for the debug panel and for tests. */
    val size: Int get() = pending.size

    /**
     * Forgets what everyone was asked, because the world they were asked in has been emptied.
     *
     * Watchers are not told. Every session is being finished in the same breath and will arrive anew;
     * a last word about a parchment in a world that no longer exists would be noise. See 0036.
     */
    override fun reset() {
        pending.clear()
    }
}
