package villages.application

import villages.domain.Banner
import villages.domain.Choice
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
import java.util.UUID

/**
 * The ports: what the use cases need from the world outside, as interfaces this module owns and the
 * infrastructure implements from the other side. Nothing here names Occurrent, MongoDB, RabbitMQ or Spring.
 */

/**
 * Where a command came from, so that the events it causes can say so.
 *
 * Provenance is a fact about messages rather than about the game, so it travels beside a command rather
 * than inside it, and it lands on the envelope rather than in the event's data. The first message of a
 * story is its own correlation: `Provenance(id, id)`. See decision record 0035.
 */
data class Provenance(
    /** The command's own id, which becomes the causation of every event it writes. */
    val commandId: UUID,
    /** The story the command continues. The server decides this; a client never names it. */
    val correlationId: UUID,
) {
    companion object {
        /** A command that starts a story of its own. */
        fun startedBy(commandId: UUID): Provenance = Provenance(commandId, commandId)
    }
}

/** Runs a command against its house's stream: load, decide, append. Throws a HouseError when refused. */
fun interface HouseCommandExecutor {
    fun execute(command: HouseCommand, provenance: Provenance)
}

/**
 * Another writer reached the stream first and the command was not applied.
 *
 * Not a `HouseError`: the decider refused nothing, and the same command tried again against the stream
 * as it now stands may well be accepted. The executor retries a few times before giving up and throwing
 * this, so seeing it means the stream is genuinely busy. See decision record 0035.
 */
class WriteConflict(val stream: String, val expectedVersion: Long) :
    RuntimeException("$stream moved on from version $expectedVersion while the command was being decided")

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
 * Fresh identities, so that a use case can mint one without reaching for a random number generator and a
 * test can hand out a known one. What it makes is a message id, never an aggregate's: those are derived.
 */
fun interface FreshIds {
    fun fresh(): UUID
}

/**
 * An event as it was stored: the envelope every event carries, and the domain event inside it. This is
 * the shape the rest of the system sees events in, whichever store they came from.
 */
data class StoredEvent(
    /** The event id: a UUID, unique across the world. What a consumer deduplicates by. */
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
    /** The story this event belongs to. Everything that followed from one command shares it. See 0035. */
    val correlationId: String,
    /** What directly caused it: for an event from a command, that command's id. See 0035. */
    val causationId: String,
    val event: HouseEvent,
)

/**
 * Where a subscriber wants a feed to begin.
 *
 * The two callers want opposite things, and the difference matters the moment events outlive the process.
 * A read model folded from the beginning is the whole of its own correctness; a watcher that replayed
 * every event ever stored on each connect would be showing history rather than what is happening.
 */
enum class Start {
    /**
     * Everything the store holds, then everything that follows. What a read model needs: it is rebuilt by
     * replaying, so a projection that only saw what came after it was built would be quietly incomplete.
     */
    FROM_THE_BEGINNING,

    /** Only what is stored from here on. What a watcher of the world happening wants. */
    FROM_NOW,
}

/**
 * Every event, as it is stored, in order. What the gateway fans out and the projections fold.
 *
 * Delivery is at least once: a subscriber that starts from the beginning may see an event twice if it was
 * appended while the replay was running, and folding the same event twice must be harmless. That is the
 * ordinary bargain of reading a log, and it is why events are folded by identity rather than counted.
 */
interface EventFeed {
    /** Delivers events until the returned handle is closed. */
    fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable
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
    /** The houses in `cell` that exist at world-time `at`, most significant first, at most `most` of them. */
    fun inCell(cell: String, at: WorldTime, most: Int): CellContents

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

/**
 * The choice a player has to make, as the read model holds it. The correlation id is the story the choice
 * began, so an action answering it can be recorded as part of the same story rather than a new one.
 */
data class ChoiceRow(
    val player: PlayerId,
    val houseId: HouseId,
    val choice: Choice,
    val correlationId: String,
)

/**
 * What each player has been asked and has not yet answered. One pending choice a player, because a player
 * has one house and a house is asked one thing at a time. See decision record 0034.
 */
interface ChoicesByPlayer {
    fun pendingOf(player: PlayerId): ChoiceRow?

    /**
     * Every change to what a player has pending, until closed: the row when one is given, and null when it
     * is answered or settled.
     */
    fun watch(listener: (PlayerId, ChoiceRow?) -> Unit): AutoCloseable
}
