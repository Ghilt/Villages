package villages.application

import villages.domain.HouseResourcePledged
import villages.domain.HouseError

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
 *
 * A wipe empties the world the wake-ups were planned in, so a wake-up planned before one does nothing at all,
 * rather than asking a house that is no longer there, or a new one founded since by the same player, for a
 * pledge it never made. Those are the rules of every [Reaction]. See decision record 0036.
 */
@Suppress("LongParameterList")
class Pledges(
    feed: EventFeed,
    later: Later,
    faults: Faults,
    private val resources: ResourceService,
    private val schedule: WorldSchedule,
    private val clock: Clock,
    private val ids: FreshIds,
) : Reaction("the pledge release", feed, later, faults) {
    override fun apply(stored: StoredEvent) {
        val event = stored.event as? HouseResourcePledged ?: return
        val due = schedule.whenIsDay(event.until)
        val waiting = java.time.Duration.between(clock.now(), due).toMillis()

        issueLater(
            "giving back pledge ${event.pledgeId.value} of ${event.houseId.stream}",
            // Already released, by its owner or by an earlier wake-up: nothing to do, nothing wrong.
            settled = setOf(HouseError.NoSuchPledge::class),
            afterMs = waiting,
        ) {
            resources.releaseHeldBy(
                houseId = event.houseId,
                pledgeId = event.pledgeId,
                // The release continues the story the pledge began, so the two read as one thing in the event
                // list; with a command id of its own, as it always had. See decision record 0035.
                provenance = Provenance(commandId = ids.fresh(), correlationId = Provenance.storyOf(stored) ?: ids.fresh()),
            )
        }
    }

    /** It folds nothing: the wake-ups it plans are all it has, and a wipe forgets those for it. */
    override fun forget() = Unit
}
