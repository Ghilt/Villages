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
import villages.domain.Pledge
import villages.domain.Resource
import villages.domain.Stock
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
 * The world's calendar, as much of it as a use case needs: how to step a world-day on by months.
 *
 * The arithmetic is `villages.protocol.Calendar`, which both ends of the wire compute alike and which this
 * layer may not see, because the application layer depends on the domain and on nothing else. So it crosses
 * as a port like everything else does. See decision record 0051.
 */
interface WorldCalendar {
    fun plusMonths(day: WorldTime, months: Long): WorldTime

    /** Whole months from one day to another, counting only the completed ones. */
    fun monthsBetween(from: WorldTime, to: WorldTime): Long
}

/**
 * When the world will reach a day, by the clock on the wall.
 *
 * The inverse of the world clock, and what anything waiting for a world-day needs: a pledge that comes
 * back in ten months has to be woken at some real instant, and only the clock knows which. Separate from
 * `WorldClock` so that that one stays a single method a test can hand over as a lambda.
 */
fun interface WorldSchedule {
    fun whenIsDay(day: WorldTime): Instant
}

/**
 * Something to be done later, once: a delay and an action.
 *
 * Owned here because two things need it and neither owns the other - the gateway coalesces its deltas
 * with it, and a pledge waits out its span with it. There is no cancelling: whatever is scheduled runs,
 * and a caller whose reason for running has gone away is expected to find that out and do nothing.
 */
fun interface Later {
    fun schedule(delayMs: Long, action: Runnable)
}

/** A `Later` on a timer thread. One thread, because nothing here is heavy and order does not matter. */
class ScheduledLater : Later, AutoCloseable {
    private val timer = java.util.concurrent.Executors.newSingleThreadScheduledExecutor { runnable ->
        Thread(runnable, "villages-later").apply { isDaemon = true }
    }

    override fun schedule(delayMs: Long, action: Runnable) {
        timer.schedule(action, delayMs.coerceAtLeast(0), java.util.concurrent.TimeUnit.MILLISECONDS)
    }

    override fun close() {
        timer.shutdownNow()
    }
}

/**
 * One world-month for every real day since the world opened, the same for everyone.
 *
 * A browser game is played in short visits, and a month a visit is what lets a house's history move while
 * the player lives their life; a world that ran at a day a day would take a lifetime to reach anything. The
 * world is shared, so the speed is not anybody's to change - there is no fast-forward in a game other people
 * are standing in. The placeholder for the chrono-engine's shared world-day. Pure, so it is a policy and not
 * infrastructure, and a test can stand at any real instant. See decision record 0051.
 */
class MonthlyWorldClock(
    private val clock: Clock,
    private val calendar: WorldCalendar,
    /** The real instant the world opened. */
    private val opened: Instant,
    /** The world-day it was on when it opened. */
    private val openingDay: WorldTime,
) : WorldClock, WorldSchedule {
    override fun today(): WorldTime {
        val realDays = java.time.Duration.between(opened, clock.now()).toDays()
        return calendar.plusMonths(openingDay, realDays.coerceAtLeast(0))
    }

    /**
     * Read backwards: a month of the world's is a real day, so the world reaches a day as many real days
     * after it opened as there are whole months between.
     *
     * Exact as long as the world opens on the first of a month, because then every day it produces is the
     * first of a month and no day-of-month is ever clamped. See the note on `Calendar.monthsBetween`.
     */
    override fun whenIsDay(day: WorldTime): Instant =
        opened.plus(java.time.Duration.ofDays(calendar.monthsBetween(openingDay, day).coerceAtLeast(0)))
}

/** Who a token belongs to. Anonymous browser tokens for now; accounts replace this without moving anything. */
fun interface PlayerTokens {
    fun playerOf(token: String): PlayerId
}

/**
 * Fresh identities, so that a use case can mint one without reaching for a random number generator and a
 * test can hand out a known one.
 *
 * What it makes is a message id, or the identity of something inside an aggregate such as a pledge. Never
 * an aggregate's own: those are derived, so that founding twice writes to one stream and is refused by the
 * decider rather than by a race. See decision record 0028.
 */
fun interface FreshIds {
    fun fresh(): UUID
}

/**
 * Empties the development world: every stream and every read model built from them, gone.
 *
 * Not the wipe of decision record 0011, which is forced by a change to an event on a world that had
 * players in it and belongs in the experiment journal. This one empties an in-memory world that dies at
 * every restart of the server anyway, from a button that is pressed many times a day. It goes, or gains
 * a guard, before the world-persistence milestone. See decision record 0036.
 */
fun interface WorldWipe {
    /** How many events were removed, so that the log line can say what happened rather than that it did. */
    fun wipe(): Int
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
 * The events the world stored most recently, for reading rather than for folding.
 *
 * A window on the end of the chronicle, not the chronicle: a viewer that opened a moment ago has missed
 * everything, and the world did not begin when it did. Reading the whole store instead would be a scan
 * on every connect and an unbounded frame, which is why this is a read model like any other.
 */
fun interface RecentEvents {
    /** The newest `most` events, oldest first, so a reader receives them in the order they happened. */
    fun latest(most: Int): List<StoredEvent>
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
) {
    /** What this house has of one resource. A founded house has all five, so this never misses. */
    fun stockOf(resource: Resource): Stock = resources.getValue(resource)

    /** How much of one resource is spoken for: the sum of the live pledges, exactly as the domain has it. */
    fun pledgedOf(resource: Resource): Long = pledges.filter { it.resource == resource }.sumOf { it.amount }

    /** The row with one of its stocks changed. */
    fun withStock(resource: Resource, change: (Stock) -> Stock): HouseRow =
        copy(resources = resources + (resource to change(stockOf(resource))))

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
     */
    fun inCell(cell: String, at: WorldTime, most: Int, everything: Boolean = false): CellContents

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
