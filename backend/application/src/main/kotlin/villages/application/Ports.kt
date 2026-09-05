package villages.application

import villages.domain.Banner
import villages.domain.HouseCommand
import villages.domain.HouseEvent
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Significance
import villages.domain.Treasury
import villages.domain.WorldTime
import java.time.Instant

/**
 * The ports: what the use cases need from the world outside, as interfaces this module owns and the
 * infrastructure implements from the other side. Nothing here names Occurrent, MongoDB, RabbitMQ or Spring.
 */

/** Runs a command against its house's stream: load, decide, append. Throws a HouseError when refused. */
fun interface HouseCommandExecutor {
    fun execute(command: HouseCommand)
}

/** The server's clock, so that a use case can be tested at a chosen instant. */
fun interface Clock {
    fun now(): Instant
}

/**
 * What day it is in the world: the world-time a thing done now is recorded as having happened at. Whose to
 * decide is the chrono-engine's, eventually; today it is one day a real day, server-wide. See 0027.
 */
fun interface WorldClock {
    fun today(): WorldTime
}

/**
 * One world-day for every real day since the world opened, the same for everyone: the placeholder for the
 * chrono-engine's shared world-day, which `SETTING.md` says is the leaning. Pure, so it is a policy and not
 * infrastructure, and a test can stand at any real instant.
 */
class DailyWorldClock(
    private val clock: Clock,
    /** The real instant the world opened. */
    private val opened: Instant,
    /** The world-day it was on when it opened. */
    private val openingDay: WorldTime,
) : WorldClock {
    override fun today(): WorldTime {
        val realDays = java.time.Duration.between(opened, clock.now()).toDays()
        return openingDay + realDays.coerceAtLeast(0)
    }
}

/** Who a token belongs to. Anonymous browser tokens for now; accounts replace this without moving anything. */
fun interface PlayerTokens {
    fun playerOf(token: String): PlayerId
}

/**
 * An event as it was stored: the envelope every event carries, and the domain event inside it. This is
 * the shape the rest of the system sees events in, whichever store they came from.
 */
data class StoredEvent(
    /** A UUID, unique across the world. */
    val id: String,
    /** `villages.<aggregate>.<verb>.v<n>`, as catalogued in docs/EVENTS.md. */
    val type: String,
    /** The stream it belongs to, `house:<uuid>`. */
    val stream: String,
    /** Its position in that stream, from one. */
    val streamVersion: Long,
    /** When it was recorded, by the server's clock. The world-time is inside the event. */
    val time: Instant,
    /** The event's data as the store holds it, JSON text. What the debug panel opens. */
    val data: String,
    val event: HouseEvent,
)

/** Every event, as it is stored, in order. What the gateway fans out and the projections fold. */
fun interface EventFeed {
    /** Delivers every event stored from now on, until the returned handle is closed. */
    fun subscribe(subscriber: (StoredEvent) -> Unit): AutoCloseable
}

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
    val treasury: Treasury,
    /** From when, in world-time, this house exists. */
    val since: WorldTime,
    /** Until when, in world-time, or null while it still does. */
    val until: WorldTime?,
    /** The stream version this row reflects, so a snapshot and a later delta can be put in order. */
    val version: Long,
) {
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
 * The map's read model: houses by cell, at a moment in world-time. A cell is a quadkey at any zoom, and
 * which houses are worth drawing at that zoom is the read model's business, not the caller's. Decision 0026.
 */
interface HousesByCell {
    /** The houses in `cell` that exist at world-time `at`, most significant first, at most `most` of them. */
    fun inCell(cell: String, at: WorldTime, most: Int): CellContents

    /** The earliest world-time anything is known to exist from, or null while nothing is. The scrubber's left end. */
    fun earliest(): WorldTime?

    /** Every row the read model changes from now on, in the order it applied them, until closed. */
    fun watch(listener: (HouseRow) -> Unit): AutoCloseable
}

/**
 * Which house is a player's, if any. Its own port rather than a method on the one above, because it
 * answers a different question for a different reason: not what is on the map, but what is yours.
 */
fun interface HousesByPlayer {
    fun ofPlayer(player: PlayerId): HouseRow?
}
