package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import villages.domain.House
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseEvent
import villages.domain.HouseId
import villages.domain.PlayerId
import villages.domain.Resource
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID

/**
 * One stream, folded in memory, that tells its subscribers as it goes: enough to watch a pledge come back
 * without a store, a broker or a clock thread.
 */
private class TinyWorld : HouseCommandExecutor, EventFeed {
    val events = mutableListOf<HouseEvent>()
    var commands = 0
    private val stored = mutableListOf<StoredEvent>()
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun execute(command: HouseCommand, provenance: Provenance) {
        commands++
        val decided = HouseDecider.decide(command, HouseDecider.fold(events))
        for (event in decided) {
            events += event
            val written = StoredEvent(
                id = UUID.randomUUID().toString(),
                type = "villages.house.${event::class.simpleName}",
                stream = event.houseId.stream,
                streamVersion = events.size.toLong(),
                time = event.recordedAt,
                data = "{}",
                correlationId = provenance.correlationId.toString(),
                causationId = provenance.commandId.toString(),
                event = event,
            )
            stored += written
            subscribers.toList().forEach { it(written) }
        }
    }

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        if (from == Start.FROM_THE_BEGINNING) {
            stored.toList().forEach(subscriber)
        }
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    fun house(): House.Founded = HouseDecider.fold(events) as House.Founded
}

/** A `Later` that runs nothing until a test says so, and says how long it was asked to wait. */
private class ManualLater : Later {
    val waits = mutableListOf<Long>()
    private val planned = mutableListOf<Runnable>()

    override fun schedule(delayMs: Long, action: Runnable) {
        waits += delayMs
        planned += action
    }

    fun tick() {
        val due = planned.toList()
        planned.clear()
        due.forEach { it.run() }
    }
}

private val thirtyDayMonths = object : WorldCalendar {
    override fun plusMonths(day: WorldTime, months: Long) = WorldTime(day.day + months * 30)

    override fun monthsBetween(from: WorldTime, to: WorldTime) = (to.day - from.day) / 30
}

/** What a test is handed: the world, its clock for later, the service to pledge with, and the follower. */
private data class Rig(val world: TinyWorld, val later: ManualLater, val resources: ResourceService, val pledges: Pledges)

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
        val pledges = Pledges(world, later, resources, clock, { now }, { UUID.randomUUID() }).started()
        // A house to pledge from, and something to pledge.
        found(world, clock.today(), now)
        resources.grant(player, Resource.REASON, 100, Provenance.startedBy(UUID.randomUUID()))
        return Rig(world, later, resources, pledges)
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
        world.house().pledgedOf(Resource.REASON) shouldBe 35

        later.tick()

        world.house().pledges.shouldBeEmpty()
        world.house().pledgedOf(Resource.REASON) shouldBe 0
        world.house().stockOf(Resource.REASON).at(opened) shouldBe 100
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
            ResourceService(world, { muchLater }, clock, thirtyDayMonths, { UUID.randomUUID() }),
            clock,
            { muchLater },
            { UUID.randomUUID() },
        ).started()

        restarted.waits.single() shouldBe 0
        restarted.tick()

        world.house().pledges.shouldBeEmpty()
    }

    "a pledge its owner released early is not released twice when the wait comes round" {
        val (world, later, resources) = rig()
        val pledgeId = resources.pledge(
            player, Resource.REASON, 35, 10, "clearer glass", Provenance.startedBy(UUID.randomUUID()),
        )
        resources.release(player, pledgeId, Provenance.startedBy(UUID.randomUUID()))
        val released = world.events.size

        // The wake-up still comes; the decider refuses it and the refusal is swallowed rather than thrown.
        later.tick()

        world.events.size shouldBe released
        world.house().pledgedOf(Resource.REASON) shouldBe 0
    }

    "a house with no pledges is waited on not at all, which is what makes this not a tick" {
        val (_, later, _) = rig()

        later.waits.shouldBeEmpty()
    }

    "a pledge whose house went in a wipe before it came back is settled, and nothing is wrong" {
        val (world, later, resources) = rig()
        resources.pledge(player, Resource.REASON, 35, 10, "clearer glass", Provenance.startedBy(UUID.randomUUID()))
        world.events.clear()

        // The release finds no house, which is as settled as a pledge already given back, and says nothing.
        later.tick()

        world.events.shouldBeEmpty()
    }

    "a wake-up planned before a wipe asks nothing of the world, though the player has founded again since" {
        val (world, later, resources, pledges) = rig()
        resources.pledge(player, Resource.REASON, 35, 10, "clearer glass", Provenance.startedBy(UUID.randomUUID()))
        // The world is emptied, everything folded from it with it, and the same player founds the same house.
        world.events.clear()
        pledges.reset()
        found(world, WorldTime(1600), opened.plusMillis(20 * day))
        val asked = world.commands

        later.tick()

        world.commands shouldBe asked
    }
})
