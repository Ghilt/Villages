package villages.projections

import villages.application.CellContents
import villages.application.EventFeed
import villages.application.EveryHouse
import villages.application.HouseChange
import villages.application.HouseRow
import villages.application.HousesByCell
import villages.application.HouseById
import villages.application.fate.HousesNear
import villages.application.fate.kmBetween
import villages.application.HousesByPlayer
import villages.application.StoredEvent
import villages.application.Follower
import villages.domain.ResourceEvent
import villages.domain.HouseFounded
import villages.domain.Pledge
import villages.domain.HouseResourceSpent
import villages.domain.HouseResourceReleased
import villages.domain.HouseResourcePledged
import villages.domain.HouseResourceGranted
import villages.domain.HouseIncomeChanged
import villages.domain.HouseId
import villages.domain.PlayerId
import villages.domain.Location
import villages.domain.WorldTime
import villages.domain.everyStock
import villages.protocol.Cell
import villages.protocol.ON_THE_MAP_FROM
import java.util.UUID
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
 * world-day asked about. Move the day and the same query is the timeline scrubber. Drop the second and it
 * is the eye, which is why that is a flag on the same query rather than a query of its own. In memory the
 * first condition is a range of an index sorted by quadkey (`CellIndex`), so a cell's own rows and no others are
 * looked at; in MongoDB it would be an anchored regex over an index, and nothing above this class changes.
 *
 * Disposable, like every read model: delete it, replay the feed, get it back.
 */
class HousesProjection(feed: EventFeed) : Follower(feed), HousesByCell, HousesByPlayer, HouseById, HousesNear, EveryHouse {
    private class Indexed(val row: HouseRow, val quadkey: String)

    // Written with the row: the cells round a place hold the houses near it, which are found without a walk of all.
    private val byCell = CellIndex<HouseId>({ it.value.toString() }, { HouseId(UUID.fromString(it)) })

    private val rows = ConcurrentHashMap<HouseId, Indexed>()

    /** Which house is whose. One entry a player, because a player founds one house; see decision 0028. */
    private val byPlayer = ConcurrentHashMap<PlayerId, HouseId>()
    private val listeners = CopyOnWriteArraySet<(HouseChange) -> Unit>()
    private val applied = AtomicLong()

    /** Folds one stored event into its row: the founding and the resources, which are all a house's row is. 0075. */
    override fun apply(stored: StoredEvent) {
        val row = when (val event = stored.event) {
            is HouseFounded -> HouseRow(
                id = event.houseId,
                player = event.player,
                name = event.name,
                seat = event.seat,
                significance = event.significance,
                banner = event.banner,
                resources = everyStock(event.resources, event.recordedAt),
                pledges = emptyList(),
                since = event.worldTime,
                until = null,
                version = stored.streamVersion,
            )

            is ResourceEvent -> resource(event, stored) ?: return
            // Every other mechanic leaves a house's row as it was: this read model draws the map. See decision record 0075.
            else -> return
        }
        // Whether this house was already on the map is the read model's to say. A stream version cannot:
        // a house founded from a choice arrives at version three, behind the choice and the action.
        val quadkey = Cell.of(row.seat.lat, row.seat.lon).quadkey
        val was = rows.put(row.id, Indexed(row = row, quadkey = quadkey))
        val appeared = was == null
        if (was?.quadkey != quadkey) {
            was?.let { byCell.remove(it.quadkey, row.id) }
            byCell.add(quadkey, row.id)
        }
        byPlayer[row.player] = row.id
        applied.incrementAndGet()
        val change = HouseChange(row, appeared)
        for (listener in listeners) {
            listener(change)
        }
    }

    /**
     * The row this event changes, already at the event's version, or null when there is no such house.
     *
     * A resource event about a house the map has never seen cannot happen - the decider refuses every
     * command that would write one - so the null is a replay that began mid-stream rather than a case
     * worth handling.
     */
    /** The row one of the resources' events leaves, or null for a house not on the map. Exhaustive over the family. */
    private fun resource(event: ResourceEvent, stored: StoredEvent): HouseRow? = when (event) {
        // What a house has changes its row but not where it is, so the same fan-out carries it: the
        // owner is told wherever they are looking, and so is anyone holding its cell.
        is HouseResourceGranted -> changed(event.houseId, stored) {
            it.withStock(event.resource) { stock -> stock.plus(event.amount, event.recordedAt) }
        }

        is HouseResourceSpent -> changed(event.houseId, stored) {
            it.withStock(event.resource) { stock -> stock.minus(event.amount, event.recordedAt) }
        }

        // A source paying something else: every stock it touches is brought up to then and set running anew.
        is HouseIncomeChanged -> changed(event.houseId, stored) {
            it.paid(event.source, event.ratesPerSecond, event.recordedAt)
        }

        is HouseResourcePledged -> changed(event.houseId, stored) {
            it.copy(
                pledges = it.pledges + Pledge(
                    id = event.pledgeId,
                    resource = event.resource,
                    amount = event.amount,
                    until = event.until,
                    purpose = event.purpose,
                ),
            )
        }

        // Dropping the pledge is the whole of the release: what is pledged is the sum of this list,
        // so nothing is added back and there is no arithmetic to get wrong.
        is HouseResourceReleased -> changed(event.houseId, stored) {
            it.copy(pledges = it.pledges.filterNot { pledge -> pledge.id == event.pledgeId })
        }
    }

    private fun changed(houseId: HouseId, stored: StoredEvent, change: (HouseRow) -> HouseRow): HouseRow? {
        val was = rows[houseId]?.row ?: return null
        return change(was).copy(version = stored.streamVersion)
    }

    override fun inCell(
        cell: String,
        at: WorldTime,
        most: Int,
        everything: Boolean,
        seen: (HouseRow) -> Boolean,
    ): CellContents {
        val zoom = cell.length
        val worthDrawing = (if (everything || zoom >= ON_THE_MAP_FROM) byCell.inCell(cell) else emptySequence())
            .mapNotNull { rows[it] }
            .filter { it.row.existsAt(at) && seen(it.row) }
            .toList()
            .sortedWith(compareByDescending<Indexed> { it.row.significance.value }.thenBy { it.row.id.value })
        return CellContents(
            houses = worthDrawing.take(most).map { it.row },
            omitted = (worthDrawing.size - most).coerceAtLeast(0),
            asOf = applied.get(),
        )
    }

    override fun earliest(): WorldTime? = rows.values.minOfOrNull { it.row.since }

    override fun ofPlayer(player: PlayerId): HouseRow? = byPlayer[player]?.let { rows[it]?.row }

    override fun ofHouse(id: HouseId): HouseRow? = rows[id]?.row

    override fun everyHouse(): List<HouseRow> = rows.values.map { it.row }.sortedBy { it.name.value }

    /** Every house standing within the distance on the day: of those in the cells round the place, the ones that near. */
    override fun near(place: Location, km: Double, at: WorldTime): List<HouseRow> =
        cellsRound(place.lat, place.lon, km).asSequence()
            .flatMap { byCell.inCell(it) }
            .distinct()
            .mapNotNull { rows[it]?.row }
            .filter { it.existsAt(at) && kmBetween(it.seat, place) <= km }
            .toList()

    override fun watch(listener: (HouseChange) -> Unit): AutoCloseable {
        listeners += listener
        return AutoCloseable { listeners -= listener }
    }

    /** How many rows there are, for the debug panel and for tests. */
    val size: Int get() = rows.size

    /**
     * Forgets every house, because the world they were in has been emptied. See decision record 0036.
     *
     * The count of applied changes keeps climbing rather than starting again: a client compares it to
     * decide whether what it holds is stale, and a number that went backwards would tell it the opposite
     * of the truth.
     */
    override fun reset() {
        rows.clear()
        byCell.clear()
        byPlayer.clear()
        applied.incrementAndGet()
    }
}
