package villages.projections

import villages.application.EventFeed
import villages.application.Follower
import villages.application.StoredEvent
import villages.application.fate.StandingAtLastRoll
import villages.domain.ChoiceEvent
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.HouseIncomeChanged
import villages.domain.Incomes
import villages.domain.HouseResourceGranted
import villages.domain.HouseResourcePledged
import villages.domain.HouseResourceReleased
import villages.domain.PlayerGivenChoice
import villages.domain.PlayerTookAction
import villages.domain.HouseResourceSpent
import villages.domain.PlayerRolled
import villages.domain.Resource
import villages.domain.ResourceEvent
import villages.domain.Stock
import villages.domain.everyStock
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
    /** A house's stocks as its own events leave them, running at what its sources pay. */
    private data class Held(val stocks: Map<Resource, Stock>, val incomes: Incomes = Incomes())

    private val now = ConcurrentHashMap<HouseId, Held>()
    private val atLastRoll = ConcurrentHashMap<HouseId, Map<Resource, Long>>()

    /** Folds one stored event: a house's stocks, and its rolls. See decision record 0075. */
    override fun apply(stored: StoredEvent) {
        when (val event = stored.event) {
            is HouseFounded -> now[event.houseId] = Held(everyStock(event.resources, event.recordedAt))
            is ResourceEvent -> resource(event)
            is ChoiceEvent -> choice(event)
            else -> Unit
        }
    }

    /** Folds one of the resources' events. Exhaustive over the family, so a new one has to be placed. */
    private fun resource(event: ResourceEvent) {
        when (event) {
            is HouseResourceGranted -> moved(event.houseId) { held ->
                held.copy(stocks = held.stocks + (event.resource to held.stocks.getValue(event.resource).plus(event.amount, event.recordedAt)))
            }
            is HouseResourceSpent -> moved(event.houseId) { held ->
                held.copy(stocks = held.stocks + (event.resource to held.stocks.getValue(event.resource).minus(event.amount, event.recordedAt)))
            }
            // What came in at a rate is a rise as much as what was granted, so a stock runs on here as it does on the house.
            is HouseIncomeChanged -> moved(event.houseId) { held ->
                held.incomes.with(event.source, event.ratesPerSecond).let { after ->
                    Held(after.rebased(held.stocks, event.recordedAt), after)
                }
            }
            // A pledge ties a resource up without changing how much there is, which is what a rise is of.
            is HouseResourcePledged, is HouseResourceReleased -> Unit
        }
    }

    /** Folds one of the choices' events: a roll, and nothing a hand dealt or taken changes here. */
    private fun choice(event: ChoiceEvent) {
        when (event) {
            is PlayerRolled -> now[event.houseId]?.let { held ->
                atLastRoll[event.houseId] = held.stocks.mapValues { (_, stock) -> stock.at(event.recordedAt) }
            }
            is PlayerGivenChoice, is PlayerTookAction -> Unit
        }
    }

    private fun moved(house: HouseId, change: (Held) -> Held) {
        now.computeIfPresent(house) { _, held -> change(held) }
    }

    override fun of(house: HouseId): Map<Resource, Long>? = atLastRoll[house]

    override fun reset() {
        now.clear()
        atLastRoll.clear()
    }
}
