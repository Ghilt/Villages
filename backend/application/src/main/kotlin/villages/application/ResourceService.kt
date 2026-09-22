package villages.application

import villages.domain.GrantResource
import villages.domain.HouseId
import villages.domain.PledgeId
import villages.domain.PledgeResource
import villages.domain.PlayerId
import villages.domain.ReleasePledge
import villages.domain.Resource
import villages.domain.SpendResource

/**
 * Doing things to what a house has: giving it some of a resource, using some up, pledging some away for a
 * span, and letting a pledge go.
 *
 * A thin seam, like every use case here. It stamps the two times, works out which house from the player,
 * and hands the command to the decider, which is where the rules are. The one thing it actually decides is
 * the day a pledge comes back: the caller asks for a span in **months**, because that is the unit the
 * world moves in, and the calendar turns it into a world-day. Months cannot cross into the domain, which
 * may not see the calendar. See decision record 0051.
 *
 * Throws a `HouseError` when the decider refuses, exactly as the decider threw it.
 */
class ResourceService(
    private val executor: HouseCommandExecutor,
    private val clock: Clock,
    private val world: WorldClock,
    private val calendar: WorldCalendar,
    private val ids: FreshIds,
) {
    fun grant(player: PlayerId, resource: Resource, amount: Long, provenance: Provenance) {
        executor.execute(
            GrantResource(HouseId.of(player), resource, amount, world.today(), clock.now()),
            provenance,
        )
    }

    fun spend(player: PlayerId, resource: Resource, amount: Long, provenance: Provenance) {
        executor.execute(
            SpendResource(HouseId.of(player), resource, amount, world.today(), clock.now()),
            provenance,
        )
    }

    /**
     * Pledge some of a resource for a number of months, and say which pledge it turned out to be.
     *
     * The id is minted here rather than sent: a client naming its own pledges could name one twice, and
     * the caller needs the answer anyway to release it again.
     */
    fun pledge(
        player: PlayerId,
        resource: Resource,
        amount: Long,
        months: Long,
        purpose: String,
        provenance: Provenance,
    ): PledgeId {
        val today = world.today()
        val pledgeId = PledgeId(ids.fresh())
        executor.execute(
            PledgeResource(
                houseId = HouseId.of(player),
                pledgeId = pledgeId,
                resource = resource,
                amount = amount,
                until = calendar.plusMonths(today, months),
                purpose = purpose,
                worldTime = today,
                recordedAt = clock.now(),
            ),
            provenance,
        )
        return pledgeId
    }

    fun release(player: PlayerId, pledgeId: PledgeId, provenance: Provenance) {
        executor.execute(
            ReleasePledge(HouseId.of(player), pledgeId, world.today(), clock.now()),
            provenance,
        )
    }
}
