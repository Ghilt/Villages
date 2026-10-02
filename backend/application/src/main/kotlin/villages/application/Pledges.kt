package villages.application

import villages.domain.HouseResourcePledged
import villages.domain.HouseError
import java.util.UUID

/**
 * The thing that gives a pledge back when its span is up.
 *
 * A pledge says which world-day it comes back on, and the world reaches a day at a real instant the clock
 * can work out, so this waits that long and then issues the release. **Not a tick**: one wake-up per
 * pledge, at the moment it is due, and nothing at all while a house has no pledges. That is decision 0006
 * applied to something that is not a rate - the world still records only changes.
 *
 * The release is an event like any other, so it shows in the event list, moves the read model and reaches
 * the player's card without anything else being told about it.
 *
 * **It does not cancel.** A pledge released early by its owner still has a wake-up coming, and when that
 * wake-up arrives the decider refuses it because the pledge is no longer there. Swallowing that refusal is
 * cheaper and more honest than keeping a cancellation table in step with the stream, and it is how
 * `Arrival` already handles asking for something the world has moved past.
 *
 * Replaying the stream from the beginning schedules a wake-up for every pledge that ever existed. The ones
 * already released fire once, find nothing and stop; the ones overdue fire immediately, which is correct,
 * because the world has passed the day they were waiting for.
 */
class Pledges(
    feed: EventFeed,
    private val later: Later,
    private val resources: ResourceService,
    private val schedule: WorldSchedule,
    private val clock: Clock,
    private val ids: FreshIds,
) : AutoCloseable {
    private val subscription: AutoCloseable = feed.subscribe(Start.FROM_THE_BEGINNING, ::apply)

    internal fun apply(stored: StoredEvent) {
        val event = stored.event as? HouseResourcePledged ?: return
        val due = schedule.whenIsDay(event.until)
        val waiting = java.time.Duration.between(clock.now(), due).toMillis()

        later.schedule(waiting.coerceAtLeast(0)) {
            try {
                resources.releaseHeldBy(
                    houseId = event.houseId,
                    pledgeId = event.pledgeId,
                    // The release continues the story the pledge began, so the two read as one thing in
                    // the event list. See decision record 0035.
                    provenance = Provenance(
                        commandId = ids.fresh(),
                        correlationId = runCatching { UUID.fromString(stored.correlationId) }
                            .getOrDefault(ids.fresh()),
                    ),
                )
                // Already released, by its owner or by an earlier wake-up: nothing to do, nothing wrong.
            } catch (@Suppress("SwallowedException") alreadyBack: HouseError.NoSuchPledge) {
                Unit
                // Gone with its house in a wipe: as settled, and as nothing wrong.
            } catch (@Suppress("SwallowedException") wiped: HouseError.NoSuchHouse) {
                Unit
            }
        }
    }

    override fun close() {
        subscription.close()
    }
}
