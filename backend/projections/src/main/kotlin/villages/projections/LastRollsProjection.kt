package villages.projections

import villages.application.EventFeed
import villages.application.Follower
import villages.application.StoredEvent
import villages.application.fate.StandingAtLastRoll
import villages.domain.CharacterEvent
import villages.domain.ChoiceEvent
import villages.domain.DialogueEvent
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.HouseResourceGranted
import villages.domain.HouseResourceSpent
import villages.domain.KeyFigureEvent
import villages.domain.PlayerRolled
import villages.domain.Resource
import villages.domain.ResourceEvent
import villages.domain.VisionEvent
import java.util.concurrent.ConcurrentHashMap

/**
 * What each house had of each resource when it last rolled, folded from the feed: the totals the founding gave,
 * moved by every grant and spend, and copied aside at every roll. What the next roll's *Piety risen* is measured
 * against. The roll's own price follows it in the same decision, so it is counted as a change since. Nothing here
 * is stored on the roll, because it can be worked out from the stream. See decision record 0083.
 *
 * Disposable, like every read model: delete it, replay the feed, get it back.
 */
class LastRollsProjection(feed: EventFeed) : Follower(feed), StandingAtLastRoll {
    private val now = ConcurrentHashMap<HouseId, Map<Resource, Long>>()
    private val atLastRoll = ConcurrentHashMap<HouseId, Map<Resource, Long>>()

    /** Folds one stored event. Exhaustive over the event types, so a new one has to be placed. */
    override fun apply(stored: StoredEvent) {
        when (val event = stored.event) {
            is HouseFounded -> now[event.houseId] = event.resources.mapValues { (_, stock) -> stock.total }
            is HouseResourceGranted -> moved(event.houseId, event.resource, event.amount)
            is HouseResourceSpent -> moved(event.houseId, event.resource, -event.amount)
            is PlayerRolled -> now[event.houseId]?.let { atLastRoll[event.houseId] = it }

            // A pledge ties a resource up without changing how much there is, which is what a rise is of.
            is ResourceEvent -> return

            // What else a house is asked, told, holds and sees, and the characters, are other read models' business.
            is ChoiceEvent, is DialogueEvent, is KeyFigureEvent, is VisionEvent, is CharacterEvent -> return
        }
    }

    private fun moved(house: HouseId, resource: Resource, by: Long) {
        now.computeIfPresent(house) { _, totals -> totals + (resource to (totals[resource] ?: 0) + by) }
    }

    override fun of(house: HouseId): Map<Resource, Long>? = atLastRoll[house]

    override fun reset() {
        now.clear()
        atLastRoll.clear()
    }
}
