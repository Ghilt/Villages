package villages.projections

import villages.application.CellContents
import villages.application.EventFeed
import villages.application.HouseRow
import villages.application.HousesByCell
import villages.application.StoredEvent
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.WorldTime
import villages.protocol.Cell
import villages.protocol.coarsestZoom
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.atomic.AtomicLong

/**
 * The map's read model, folded from the event feed: one row per house, indexed by the deepest cell its
 * seat falls in and by the coarsest zoom it is worth drawing at, and carrying the span of world-time it
 * exists over.
 *
 * A query for a cell at a moment is then the three conditions of decision 0026 and nothing else: the row's
 * quadkey starts with the cell, the cell's zoom is at least the row's coarsest, and the house exists on the
 * world-day asked about. Move the day and the same query is the timeline scrubber. In memory the first
 * condition is a `startsWith` over every row; in MongoDB it is an anchored regex over an index, and nothing
 * above this class changes.
 *
 * Disposable, like every read model: delete it, replay the feed, get it back.
 */
class HousesByCellProjection(feed: EventFeed) : HousesByCell, AutoCloseable {
    private class Indexed(val row: HouseRow, val quadkey: String, val coarsestZoom: Int)

    private val rows = ConcurrentHashMap<HouseId, Indexed>()
    private val listeners = CopyOnWriteArraySet<(HouseRow) -> Unit>()
    private val applied = AtomicLong()
    private val subscription: AutoCloseable = feed.subscribe(::apply)

    /** Folds one stored event into its row. Exhaustive over the event types, so a new one has to be placed. */
    internal fun apply(stored: StoredEvent) {
        val row = when (val event = stored.event) {
            is HouseFounded -> HouseRow(
                id = event.houseId,
                name = event.name,
                seat = event.seat,
                significance = event.significance,
                banner = event.banner,
                treasury = event.treasury,
                since = event.worldTime,
                until = null,
                version = stored.streamVersion,
            )
        }
        rows[row.id] = Indexed(
            row = row,
            quadkey = Cell.of(row.seat.lat, row.seat.lon).quadkey,
            coarsestZoom = coarsestZoom(row.significance.value),
        )
        applied.incrementAndGet()
        for (listener in listeners) {
            listener(row)
        }
    }

    override fun inCell(cell: String, at: WorldTime, most: Int): CellContents {
        val zoom = cell.length
        val worthDrawing = rows.values
            .filter { it.quadkey.startsWith(cell) && it.coarsestZoom <= zoom && it.row.existsAt(at) }
            .sortedWith(compareByDescending<Indexed> { it.row.significance.value }.thenBy { it.row.id.value })
        return CellContents(
            houses = worthDrawing.take(most).map { it.row },
            omitted = (worthDrawing.size - most).coerceAtLeast(0),
            asOf = applied.get(),
        )
    }

    override fun earliest(): WorldTime? = rows.values.minOfOrNull { it.row.since }

    override fun watch(listener: (HouseRow) -> Unit): AutoCloseable {
        listeners += listener
        return AutoCloseable { listeners -= listener }
    }

    /** How many rows there are, for the debug panel and for tests. */
    val size: Int get() = rows.size

    override fun close() {
        subscription.close()
    }
}
