package villages.projections

import villages.application.EventFeed
import villages.application.Sight
import villages.application.SightChange
import villages.application.SightsByHouse
import villages.application.StoredEvent
import villages.application.VisionPoint
import villages.application.VisionSource
import villages.application.Follower
import villages.domain.CharacterAged
import villages.domain.CharacterAppeared
import villages.domain.CharacterDied
import villages.domain.CharacterId
import villages.domain.CharacterLeftTheMap
import villages.domain.CharacterMoved
import villages.domain.CharacterPortraitChanged
import villages.domain.CharacterStatChanged
import villages.domain.HouseFounded
import villages.domain.HouseGainedKeyFigure
import villages.domain.HouseGainedVision
import villages.domain.HouseId
import villages.domain.HouseLostKeyFigure
import villages.domain.HouseLostVision
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Vision
import villages.domain.WorldTime
import villages.domain.ResourceEvent
import villages.domain.ChoiceEvent
import villages.domain.DialogueEvent
import villages.domain.StructureEvent
import villages.domain.StructureId
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Every house's vision points, folded from the feed: what each house sees now, and what it has seen.
 *
 * Three things give a house vision today. Two are worked out here rather than recorded, because the world
 * already records where they stand and a second record of the same place could come to disagree with the
 * first. Its **seat** gives a point from the day it was founded. Each of its **key figures** gives one for
 * every stretch they stood in one place while they were the house's: a move closes the point they stood at
 * and opens the next, and leaving the map, dying or being lost to the house closes it. The third is **vision
 * given outright**, which nothing else records, so it is its own pair of events and is read straight off
 * them. A closed point is still a point, because what it covered stays revealed. See decision record 0061.
 *
 * The fold is its own rather than a read of the characters projection, because two subscriptions can stand
 * at different points in the feed; where a character stands and whose they are is folded here as well.
 *
 * **Every event is placed**, the `when` below being exhaustive, so an event that ought to give vision or
 * take it away cannot arrive unnoticed: anything can give vision in time, and each new thing that does is a
 * branch here.
 *
 * Disposable, like every read model: delete it, replay the feed, get it back.
 */
class SightProjection(feed: EventFeed) : Follower(feed), SightsByHouse {
    /** Whose each house is, so that a change reaches the right player. */
    private val players = ConcurrentHashMap<HouseId, PlayerId>()

    /** Every vision point each house has had, oldest first. The open ones are those still giving vision. */
    private val points = ConcurrentHashMap<HouseId, CopyOnWriteArrayList<VisionPoint>>()

    /** The houses holding each character as a key figure now. */
    private val holders = ConcurrentHashMap<CharacterId, CopyOnWriteArraySet<HouseId>>()

    /** Where each character stands on the map now; absent while they are on none, which includes the dead. */
    private val standing = ConcurrentHashMap<CharacterId, Location>()

    private val listeners = CopyOnWriteArraySet<(SightChange) -> Unit>()

    override fun apply(stored: StoredEvent) {
        when (val event = stored.event) {
            is HouseFounded -> {
                players[event.houseId] = event.player
                open(event.houseId, VisionSource.Seat, event.seat, Vision.MALLORCA, event.worldTime)
                tell(event.houseId)
            }

            // The size is the event's own, not the rule's today: a vision given is what it was given as.
            is HouseGainedVision -> {
                open(event.houseId, VisionSource.Given(event.visionId), event.place, event.radius, event.worldTime, event.from)
                tell(event.houseId)
            }

            is HouseLostVision -> {
                if (close(event.houseId, VisionSource.Given(event.visionId), event.worldTime)) {
                    tell(event.houseId)
                }
            }

            // Taken in while standing somewhere, a key figure gives vision from the day they became the
            // house's, not from the day they came to stand there: what they saw before was not the house's.
            is HouseGainedKeyFigure -> {
                holders.getOrPut(event.characterId) { CopyOnWriteArraySet() } += event.houseId
                val place = standing[event.characterId] ?: return
                open(event.houseId, VisionSource.KeyFigure(event.characterId), place, Vision.MALLORCA, event.worldTime)
                tell(event.houseId)
            }

            is HouseLostKeyFigure -> {
                holders[event.characterId]?.remove(event.houseId)
                if (close(event.houseId, VisionSource.KeyFigure(event.characterId), event.worldTime)) {
                    tell(event.houseId)
                }
            }

            is CharacterMoved -> {
                standing[event.characterId] = event.place
                val source = VisionSource.KeyFigure(event.characterId)
                for (house in holders[event.characterId].orEmpty()) {
                    close(house, source, event.worldTime)
                    open(house, source, event.place, Vision.MALLORCA, event.worldTime)
                    tell(house)
                }
            }

            // The dead are on no map from the day they die, and no `leftTheMap` is written to say so.
            is CharacterLeftTheMap -> offTheMap(event.characterId, event.worldTime)
            is CharacterDied -> offTheMap(event.characterId, event.worldTime)

            // Nothing else gives vision or takes it away.
            is ResourceEvent, is ChoiceEvent, is DialogueEvent,
            is CharacterAppeared, is CharacterStatChanged, is CharacterAged, is CharacterPortraitChanged,
            // What a structure gives its holder to see is written into the house's own history, as vision given. 0092.
            is StructureEvent,
            -> Unit
        }
    }

    private fun offTheMap(character: CharacterId, on: WorldTime) {
        standing.remove(character)
        val source = VisionSource.KeyFigure(character)
        for (house in holders[character].orEmpty()) {
            if (close(house, source, on)) {
                tell(house)
            }
        }
    }

    private fun open(house: HouseId, source: VisionSource, place: Location, radius: Double, on: WorldTime, from: StructureId? = null) {
        points.getOrPut(house) { CopyOnWriteArrayList() } +=
            VisionPoint(source, place, radius = radius, since = on, until = null, from = from)
    }

    /** Ends the point this source is giving the house, if it is giving one. Says whether it was. */
    private fun close(house: HouseId, source: VisionSource, on: WorldTime): Boolean {
        val had = points[house] ?: return false
        val at = had.indexOfLast { it.source == source && it.until == null }
        if (at < 0) {
            return false
        }
        had[at] = had[at].copy(until = on)
        return true
    }

    private fun tell(house: HouseId) {
        val player = players[house] ?: return
        val change = SightChange(house, player, of(house))
        for (listener in listeners) {
            listener(change)
        }
    }

    override fun of(house: HouseId): Sight = Sight(house, points[house]?.toList().orEmpty())

    override fun watch(listener: (SightChange) -> Unit): AutoCloseable {
        listeners += listener
        return AutoCloseable { listeners -= listener }
    }

    /** Forgets every house's sight, because the world they saw has been emptied. See decision record 0036. */
    override fun reset() {
        players.clear()
        points.clear()
        holders.clear()
        standing.clear()
    }
}
