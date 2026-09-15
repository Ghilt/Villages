package villages.projections

import villages.application.ChoiceRow
import villages.application.ChoicesByPlayer
import villages.application.EventFeed
import villages.application.Start
import villages.application.StoredEvent
import villages.domain.HouseFounded
import villages.domain.HouseGivenChoice
import villages.domain.HouseTookAction
import villages.domain.PlayerId
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
class ChoicesProjection(feed: EventFeed) : ChoicesByPlayer, AutoCloseable {
    private val pending = ConcurrentHashMap<PlayerId, ChoiceRow>()
    private val listeners = CopyOnWriteArraySet<(PlayerId, ChoiceRow?) -> Unit>()

    // From the beginning: a read model is its fold of every event. See decision record 0029.
    private val subscription: AutoCloseable = feed.subscribe(Start.FROM_THE_BEGINNING, ::apply)

    /** Folds one stored event. Exhaustive over the event types, so a new one has to be placed. */
    internal fun apply(stored: StoredEvent) {
        when (val event = stored.event) {
            is HouseGivenChoice -> {
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

            is HouseTookAction -> forget(event.player)

            // Founding by any means settles the question of where to found, so whatever was pending goes.
            // The domain says the same thing in `evolve`; this is that rule read off the events.
            is HouseFounded -> forget(event.player)
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
    fun reset() {
        pending.clear()
    }

    override fun close() {
        subscription.close()
    }
}
