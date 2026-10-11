package villages.application

import villages.domain.Banner
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.IncomeSource
import villages.domain.Incomes
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Pledge
import villages.domain.Resource
import villages.domain.Significance
import villages.domain.Stock
import villages.domain.WorldTime
import java.time.Instant

/**
 * A house as the map's read model holds it. Not the domain's `House`: this is shaped for drawing, and it
 * carries the span of world-time the house exists over, which the domain's state never needed to. Today
 * `since` is the founding instant and `until` is open; the timeline scrubber reads these two.
 */
data class HouseRow(
    val id: HouseId,
    /** Whose house it is. Kept, because a player has to be told which house is theirs. */
    val player: PlayerId,
    val name: HouseName,
    val seat: Location,
    val significance: Significance,
    val banner: Banner,
    /** One stock of every resource, as the house's own events last said. */
    val resources: Map<Resource, Stock>,
    /** The live pledges against those stocks, and the only record of what is spoken for. */
    val pledges: List<Pledge>,
    /** From when, in world-time, this house exists. */
    val since: WorldTime,
    /** Until when, in world-time, or null while it still does. */
    val until: WorldTime?,
    /** The stream version this row reflects, so a snapshot and a later delta can be put in order. */
    val version: Long,
    /** What each source pays it, whose sum is each stock's rate. */
    val incomes: Incomes = Incomes(),
) {
    /** What this house has of one resource. A founded house has all five, so this never misses. */
    fun stockOf(resource: Resource): Stock = resources.getValue(resource)

    /** How much of one resource is spoken for: the sum of the live pledges, exactly as the domain has it. */
    fun pledgedOf(resource: Resource): Long = pledges.filter { it.resource == resource }.sumOf { it.amount }

    /** The row with one of its stocks changed. */
    fun withStock(resource: Resource, change: (Stock) -> Stock): HouseRow =
        copy(resources = resources + (resource to change(stockOf(resource))))

    /** The row with one source paying [rates] from [at]: every stock it touches brought up to then and set running. */
    fun paid(source: IncomeSource, rates: Map<Resource, Double>, at: Instant): HouseRow =
        incomes.with(source, rates).let { after -> copy(incomes = after, resources = after.rebased(resources, at)) }

    fun existsAt(at: WorldTime): Boolean = at >= since && (until == null || at < until)
}

/** What one cell holds at one moment: the houses worth drawing, and how many more there were. */
data class CellContents(
    val houses: List<HouseRow>,
    /** Houses in the cell that were left out because the cell holds more than a screen should carry. */
    val omitted: Int,
    /** How many changes the read model had applied when this was read. Monotonic, and only ever compared. */
    val asOf: Long,
)

/**
 * A change the read model has applied, and whether it put a house there that was not there before.
 *
 * The distinction is the read model's to make and nobody else's: a stream version cannot tell you, because
 * a house founded from a choice arrives at version three, behind the choice it was given and the action
 * that took it.
 */
data class HouseChange(val row: HouseRow, val appeared: Boolean)

/**
 * The map's read model: houses by cell, at a moment in world-time. A cell is a quadkey at any zoom, and
 * which houses are worth drawing at that zoom is the read model's business, not the caller's. Decision 0026.
 */
interface HousesByCell {
    /**
     * The houses in `cell` that exist at world-time `at`, most significant first, at most `most` of them.
     *
     * `everything` sets significance aside: the cell hands back all it holds, however slight, rather than
     * only what is worth drawing at its zoom. That is the eye, and it is a way of looking rather than a
     * different question, which is why it is a parameter and not a port of its own. See 0038.
     *
     * `seen` says which houses the asker may be sent at all, which is the fog of war (0061). It is asked
     * before the cap, so a cell full of houses the asker cannot see does not crowd out one it can, and what
     * it refuses is not counted as omitted, because how many houses are hidden is itself something learnt.
     */
    fun inCell(
        cell: String,
        at: WorldTime,
        most: Int,
        everything: Boolean = false,
        seen: (HouseRow) -> Boolean = { true },
    ): CellContents

    /** The earliest world-time anything is known to exist from, or null while nothing is. The scrubber's left end. */
    fun earliest(): WorldTime?

    /** Every change the read model makes from now on, in the order it applied them, until closed. */
    fun watch(listener: (HouseChange) -> Unit): AutoCloseable
}

/**
 * Which house is a player's, if any. Its own port rather than a method on the one above, because it
 * answers a different question for a different reason: not what is on the map, but what is yours.
 */
fun interface HousesByPlayer {
    fun ofPlayer(player: PlayerId): HouseRow?
}

/** A house by its own id, if there is one: what a choice roll asks of a house the page says it is inspecting. */
fun interface HouseById {
    fun ofHouse(id: HouseId): HouseRow?
}
