package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import villages.domain.HouseId
import villages.domain.PlayerId
import villages.domain.Resource
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID

private val thirtyDayMonths = object : WorldCalendar {
    override fun plusMonths(day: WorldTime, months: Long) = WorldTime(day.day + months * 30)

    override fun monthsBetween(from: WorldTime, to: WorldTime) = (to.day - from.day) / 30
}

/** What a test is handed: the world, its clock for later, the service to pledge with, the follower and its faults. */
private data class Rig(
    val world: TinyWorld,
    val later: ManualLater,
    val resources: ResourceService,
    val pledges: Pledges,
    val faults: KeptFaults,
)

class PledgesSpec : StringSpec({
    val opened = Instant.parse("2026-09-01T00:00:00Z")
    val day = 24 * 60 * 60 * 1000L
    val player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val house = HouseId.of(player)
    val openingDay = WorldTime(1000)

    fun found(world: TinyWorld, on: WorldTime, at: Instant) = world.execute(
        villages.domain.FoundHouse(
            house, player, villages.domain.HouseName("Ravenscar"),
            villages.domain.Location(59.33, 18.07),
            villages.domain.Banner(
                villages.domain.Tincture.SABLE, villages.domain.Division.PLAIN, null,
                villages.domain.Charge.STAG, villages.domain.Tincture.ARGENT,
            ),
            on, at,
        ),
        Provenance.startedBy(UUID.randomUUID()),
    )

    /** The world twenty days in: twenty months on, and the clock able to read a day back to an instant. */
    fun rig(now: Instant = opened.plusMillis(20 * day)): Rig {
        val world = TinyWorld()
        val later = ManualLater()
        val clock = MonthlyWorldClock({ now }, thirtyDayMonths, opened, openingDay)
        val resources = ResourceService(world, { now }, clock, thirtyDayMonths, { UUID.randomUUID() })
        val faults = KeptFaults()
        val pledges = Pledges(world, later, faults, WipeGate(), resources, clock, { now }, { UUID.randomUUID() }).started()
        // A house to pledge from, and something to pledge.
        found(world, clock.today(), now)
        resources.grant(player, Resource.REASON, 100, Provenance.startedBy(UUID.randomUUID()))
        return Rig(world, later, resources, pledges, faults)
    }

    "a pledge is waited out for as many real days as it has months, because a day is a month" {
        val (_, later, resources) = rig()

        resources.pledge(player, Resource.REASON, 35, 10, "clearer glass", Provenance.startedBy(UUID.randomUUID()))

        // Twenty months in and pledged for ten more: the world reaches that day on the thirtieth real day,
        // which is ten days from now.
        later.waits.single() shouldBe 10 * day
    }

    "when the wait is over the pledge comes back, and what it held is free again" {
        val (world, later, resources) = rig()
        resources.pledge(player, Resource.REASON, 35, 10, "clearer glass", Provenance.startedBy(UUID.randomUUID()))
        world.founded(house).pledgedOf(Resource.REASON) shouldBe 35

        later.tick()

        world.founded(house).pledges.shouldBeEmpty()
        world.founded(house).pledgedOf(Resource.REASON) shouldBe 0
        world.founded(house).stockOf(Resource.REASON).at(opened) shouldBe 100
    }

    "a pledge whose day the world has already passed is given back at once, which is what a restart does" {
        val (world, _, resources) = rig()
        resources.pledge(player, Resource.REASON, 35, 10, "clearer glass", Provenance.startedBy(UUID.randomUUID()))

        // The server comes back up a year later and replays the stream from the beginning. The pledge's
        // day went by while it was down, so its wake-up is due now rather than in ten days.
        val muchLater = opened.plusMillis(400 * day)
        val restarted = ManualLater()
        val clock = MonthlyWorldClock({ muchLater }, thirtyDayMonths, opened, openingDay)
        Pledges(
            world,
            restarted,
            KeptFaults(),
            WipeGate(),
            ResourceService(world, { muchLater }, clock, thirtyDayMonths, { UUID.randomUUID() }),
            clock,
            { muchLater },
            { UUID.randomUUID() },
        ).started()

        restarted.waits.single() shouldBe 0
        restarted.tick()

        world.founded(house).pledges.shouldBeEmpty()
    }

    "a pledge its owner released early is not released twice when the wait comes round" {
        val (world, later, resources) = rig()
        val pledgeId = resources.pledge(
            player, Resource.REASON, 35, 10, "clearer glass", Provenance.startedBy(UUID.randomUUID()),
        )
        resources.release(player, pledgeId, Provenance.startedBy(UUID.randomUUID()))
        val released = world.stored.size

        // The wake-up still comes; the decider refuses it and the refusal is swallowed rather than thrown.
        later.tick()

        world.stored.size shouldBe released
        world.founded(house).pledgedOf(Resource.REASON) shouldBe 0
    }

    "a house with no pledges is waited on not at all, which is what makes this not a tick" {
        val (_, later, _) = rig()

        later.waits.shouldBeEmpty()
    }

    "a pledge whose house went in a wipe before it came back is settled, and nothing is wrong" {
        val (world, later, resources, _, faults) = rig()
        resources.pledge(player, Resource.REASON, 35, 10, "clearer glass", Provenance.startedBy(UUID.randomUUID()))
        world.wipe()

        // The release finds no house, which is as settled as a pledge already given back, and says nothing.
        later.tick()

        world.stored.shouldBeEmpty()
        faults.reported.shouldBeEmpty()
    }

    "a wake-up planned before a wipe asks nothing of the world, though the player has founded again since" {
        val (world, later, resources, pledges) = rig()
        resources.pledge(player, Resource.REASON, 35, 10, "clearer glass", Provenance.startedBy(UUID.randomUUID()))
        // The world is emptied, everything folded from it with it, and the same player founds the same house.
        world.wipe()
        pledges.reset()
        found(world, WorldTime(1600), opened.plusMillis(20 * day))
        val asked = world.commands

        later.tick()

        world.commands shouldBe asked
    }
})
