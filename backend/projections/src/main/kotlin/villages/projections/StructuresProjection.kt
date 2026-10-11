package villages.projections

import villages.application.EventFeed
import villages.application.Follower
import villages.application.Holder
import villages.application.StoredEvent
import villages.application.StructureChange
import villages.application.StructureFace
import villages.application.StructureRow
import villages.application.StructuresByCell
import villages.domain.CharacterEvent
import villages.domain.ChoiceEvent
import villages.domain.DialogueEvent
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.HouseNamedSeat
import villages.domain.KeyFigureEvent
import villages.domain.ResourceEvent
import villages.domain.StructureId
import villages.domain.StructureChangedHands
import villages.domain.StructureRaised
import villages.domain.VisionEvent
import villages.protocol.Cell
import villages.protocol.coarsestZoom
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.atomic.AtomicLong

/**
 * The map's read model of structures, folded from the event feed: one row per structure, indexed by the deepest cell
 * it stands in and by the coarsest zoom its most significant face was ever worth drawing at, with every face it has
 * had over world-time. Which of them a house is sent is the fog's to say, at the gateway: the face of today where it
 * sees, the one it last saw where it saw once, none where it never did. See decision record 0092.
 *
 * It keeps the houses a structure can be held by, their names and banners, so a face carries what its pennant needs
 * without asking another read model: the one feed delivers a house's founding before anything it holds, and a house's
 * name and banner never change.
 *
 * An event at or below the stream version already folded for its structure is passed over, because the feed delivers
 * at least once and a face appended twice would be a change that never happened. Disposable, like every read model.
 */
class StructuresProjection(feed: EventFeed) : Follower(feed), StructuresByCell {
    private class Indexed(val row: StructureRow, val quadkey: String, val coarsestZoom: Int, val streamVersion: Long)

    private val rows = ConcurrentHashMap<StructureId, Indexed>()
    private val holders = ConcurrentHashMap<HouseId, Holder>()
    private val listeners = CopyOnWriteArraySet<(StructureChange) -> Unit>()
    private val applied = AtomicLong()

    override fun apply(stored: StoredEvent) {
        when (val event = stored.event) {
            is HouseFounded -> holders[event.houseId] = Holder(event.houseId, event.name, event.banner)
            is StructureRaised -> {
                if (rows.containsKey(event.structureId)) return
                val face = StructureFace(
                    type = event.structureType,
                    level = event.level,
                    // Unknown only if the feed began mid-history, which a replay from the beginning never does.
                    holder = event.holder?.let(holders::get),
                    significance = event.significance,
                    since = event.worldTime,
                    stamp = applied.incrementAndGet(),
                )
                put(StructureRow(event.structureId, event.name, event.place, listOf(face)), stored.streamVersion, appeared = true)
            }
            // A new face from the day it changed hands, the old one kept for whoever last saw it so.
            is StructureChangedHands -> {
                val held = rows[event.structureId] ?: return
                if (stored.streamVersion <= held.streamVersion) return
                val last = held.row.faces.last()
                val face = last.copy(
                    holder = event.to?.let(holders::get),
                    // Handed to another, it is no longer its old holder's seat as far as the map knows; the house's own
                    // loss of it is step 9 of the plan.
                    seatOf = last.seatOf?.takeIf { it.house == event.to },
                    since = event.worldTime,
                    stamp = applied.incrementAndGet(),
                )
                put(held.row.copy(faces = held.row.faces + face), stored.streamVersion, appeared = false)
            }
            // Whose seat it is goes on its face, so a house that last saw it sees it as whose seat it was then.
            is HouseNamedSeat -> {
                val held = rows[event.structureId] ?: return
                val last = held.row.faces.last()
                if (last.seatOf?.house == event.houseId) return
                val face = last.copy(seatOf = holders[event.houseId], since = event.worldTime, stamp = applied.incrementAndGet())
                put(held.row.copy(faces = held.row.faces + face), held.streamVersion, appeared = false)
            }
            // What a house has, is asked, is told, holds and sees, and what befalls a person, changes no structure.
            is ResourceEvent, is ChoiceEvent, is DialogueEvent, is KeyFigureEvent, is VisionEvent, is CharacterEvent -> Unit
        }
    }

    private fun put(row: StructureRow, streamVersion: Long, appeared: Boolean) {
        rows[row.id] = Indexed(
            row = row,
            quadkey = Cell.of(row.place.lat, row.place.lon).quadkey,
            coarsestZoom = coarsestZoom(row.mostSignificant.value),
            streamVersion = streamVersion,
        )
        val change = StructureChange(row, appeared)
        for (listener in listeners) {
            listener(change)
        }
    }

    override fun inCell(cell: String, everything: Boolean): List<StructureRow> {
        val zoom = cell.length
        return rows.values
            .filter { it.quadkey.startsWith(cell) && (everything || it.coarsestZoom <= zoom) }
            .map { it.row }
    }

    override fun row(id: StructureId): StructureRow? = rows[id]?.row

    override fun asOf(): Long = applied.get()

    override fun watch(listener: (StructureChange) -> Unit): AutoCloseable {
        listeners += listener
        return AutoCloseable { listeners -= listener }
    }

    /**
     * Forgets every structure and every holder, because the world they were in has been emptied. The count of applied
     * changes keeps climbing, as the houses' does: a page compares stamps with it, and one that went backwards would
     * tell it the opposite of the truth. See decision record 0036.
     */
    override fun reset() {
        rows.clear()
        holders.clear()
        applied.incrementAndGet()
    }
}
