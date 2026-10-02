package villages.projections

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import villages.application.EventFeed
import villages.application.HouseChange
import villages.application.HouseRow
import villages.application.Start
import villages.application.StoredEvent
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.HouseFounded
import villages.domain.Resource
import villages.domain.PledgeId
import villages.domain.HouseResourceReleased
import villages.domain.HouseResourcePledged
import villages.domain.HouseResourceGranted
import villages.domain.HouseEvent
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Significance
import villages.domain.Tincture
import villages.domain.emptyStocks
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID
import villages.domain.Stock

/** A feed that delivers what it is handed, when it is handed it, and can hand over what came before. */
private class HandFed : EventFeed {
    private val stored = mutableListOf<StoredEvent>()
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        if (from == Start.FROM_THE_BEGINNING) {
            stored.forEach(subscriber)
        }
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    fun deliver(event: HouseEvent, version: Long = 1) {
        val stored = StoredEvent(
            id = UUID.randomUUID().toString(),
            type = "villages.house.${event::class.simpleName}",
            stream = event.houseId.stream,
            streamVersion = version,
            time = event.recordedAt,
            data = "{}",
            correlationId = UUID.randomUUID().toString(),
            causationId = UUID.randomUUID().toString(),
            event = event,
        )
        this.stored += stored
        subscribers.toList().forEach { it(stored) }
    }
}

private val noon = Instant.parse("2026-09-04T12:00:00Z")

/** The twenty-fourth of June, year 1246: the world-day the fixtures stand on. */
private val someDay = WorldTime(454901)

private fun founded(
    name: String,
    lat: Double,
    lon: Double,
    significance: Double = 20.0,
    on: WorldTime = someDay,
    at: Instant = noon,
    player: PlayerId = PlayerId(UUID.randomUUID()),
) = HouseFounded(
    houseId = HouseId.of(player),
    player = player,
    name = HouseName(name),
    seat = Location(lat, lon),
    significance = Significance(significance),
    banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
    resources = emptyStocks(at),
    worldTime = on,
    recordedAt = at,
)

/** Stockholm, before the warp: the shared vector every zoom of it is known for. */
private const val STOCKHOLM_Z10 = "1200312213"
private const val STOCKHOLM_Z8 = "12003122"
private const val STOCKHOLM_Z4 = "1200"

class HousesProjectionSpec : StringSpec({

    "a founded house is in its own cell, and in every cell above it down to where its significance runs out" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        feed.deliver(founded("Ravenscar", 59.33, 18.07, significance = 20.0))

        // Twenty is worth drawing from zoom eight in, and not from further out.
        houses.inCell(STOCKHOLM_Z10, someDay, 10).houses.map { it.name } shouldBe listOf(HouseName("Ravenscar"))
        houses.inCell(STOCKHOLM_Z8, someDay, 10).houses shouldHaveSize 1
        houses.inCell(STOCKHOLM_Z8.take(7), someDay, 10).houses.shouldBeEmpty()
        houses.inCell(STOCKHOLM_Z4, someDay, 10).houses.shouldBeEmpty()
        houses.inCell("", someDay, 10).houses.shouldBeEmpty()
    }

    "everything sets significance aside, and nothing else about the query" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        feed.deliver(founded("Ravenscar", 59.33, 18.07, significance = 20.0, on = someDay))

        // The whole world, however slight the thing in it: that is the eye. See decision record 0038.
        houses.inCell("", someDay, 10, everything = true).houses shouldHaveSize 1
        houses.inCell(STOCKHOLM_Z4, someDay, 10, everything = true).houses shouldHaveSize 1

        // The other two conditions still hold: a cell the seat is not in, and a day before it existed.
        houses.inCell("3", someDay, 10, everything = true).houses.shouldBeEmpty()
        houses.inCell("", someDay - 1, 10, everything = true).houses.shouldBeEmpty()
    }

    "a legendary thing is drawn from the whole world" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        feed.deliver(founded("St John's", 59.33, 18.07, significance = 100.0))

        houses.inCell("", someDay, 10).houses shouldHaveSize 1
        houses.inCell(STOCKHOLM_Z4, someDay, 10).houses shouldHaveSize 1
    }

    "a house is not in a cell its seat does not fall in" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        feed.deliver(founded("Ravenscar", 59.33, 18.07))

        // Cape Town's cell, at the same zoom.
        houses.inCell("30023103", someDay, 10).houses.shouldBeEmpty()
    }

    "a house exists from its founding world-day onward, and not the day before, whenever it was recorded" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        feed.deliver(founded("Ravenscar", 59.33, 18.07, on = someDay, at = noon))

        houses.inCell(STOCKHOLM_Z8, someDay - 1, 10).houses.shouldBeEmpty()
        houses.inCell(STOCKHOLM_Z8, someDay, 10).houses shouldHaveSize 1
        houses.inCell(STOCKHOLM_Z8, someDay + 365 * 300, 10).houses shouldHaveSize 1
    }

    "the earliest world-day anything exists from is the scrubber's left end, and nothing means nothing" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        houses.earliest() shouldBe null

        feed.deliver(founded("Later", 59.33, 18.07, on = someDay))
        feed.deliver(founded("Earlier", 59.34, 18.08, on = someDay - 36500))

        houses.earliest() shouldBe someDay - 36500
    }

    "the most significant come first, and what will not fit is counted rather than lost" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        feed.deliver(founded("Lesser", 59.33, 18.07, significance = 30.0))
        feed.deliver(founded("Greatest", 59.331, 18.071, significance = 90.0))
        feed.deliver(founded("Middling", 59.332, 18.072, significance = 60.0))

        val contents = houses.inCell(STOCKHOLM_Z8, someDay, 2)

        contents.houses.map { it.name.value } shouldBe listOf("Greatest", "Middling")
        contents.omitted shouldBe 1
    }

    "a watcher hears each change as it is applied, and the read model counts what it applied" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        val heard = mutableListOf<HouseChange>()
        houses.watch { heard += it }

        feed.deliver(founded("Ravenscar", 59.33, 18.07))
        feed.deliver(founded("Hollin", 59.41, 17.95))

        heard.map { it.row.name.value } shouldBe listOf("Ravenscar", "Hollin")
        heard.first().row.version shouldBe 1
        houses.inCell(STOCKHOLM_Z8, someDay, 10).asOf shouldBe 2
        houses.size shouldBe 2
    }

    "and says which of them put a house on the map that was not there before" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        val heard = mutableListOf<HouseChange>()
        houses.watch { heard += it }

        val ravenscar = founded("Ravenscar", 59.33, 18.07)
        feed.deliver(ravenscar)
        // The same house again, as a replay would deliver it, and then changed.
        feed.deliver(ravenscar)
        feed.deliver(ravenscar.copy(name = HouseName("Ravenscar the Younger")), version = 2)

        heard.map { it.appeared } shouldBe listOf(true, false, false)
    }

    "a reset read model has forgotten every house, and still counts forward" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        feed.deliver(founded("Ravenscar", 59.33, 18.07))
        val before = houses.inCell(STOCKHOLM_Z8, someDay, 10).asOf

        houses.reset()

        houses.size shouldBe 0
        houses.inCell(STOCKHOLM_Z8, someDay, 10).houses.shouldBeEmpty()
        // A count that went backwards would tell a client the opposite of the truth about staleness.
        (houses.inCell(STOCKHOLM_Z8, someDay, 10).asOf > before) shouldBe true
    }

    "a watcher that stopped hears nothing more" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        val heard = mutableListOf<HouseChange>()
        houses.watch { heard += it }.close()

        feed.deliver(founded("Ravenscar", 59.33, 18.07))

        heard.shouldBeEmpty()
    }

    "a player's own house can be found, and a player without one has none" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        val adam = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
        val nobody = PlayerId(UUID.randomUUID())

        feed.deliver(founded("Ravenscar", 59.33, 18.07, player = adam))

        houses.ofPlayer(adam)?.name shouldBe HouseName("Ravenscar")
        houses.ofPlayer(adam)?.id shouldBe HouseId.of(adam)
        houses.ofPlayer(nobody) shouldBe null
    }

    "a projection built after the events already exist still has them" {
        // The bug this prevents: a store that outlives the process, and a read model that starts from now
        // and is therefore missing everything founded before the last restart, silently and for ever.
        val feed = HandFed()
        feed.deliver(founded("Ravenscar", 59.33, 18.07))
        feed.deliver(founded("Hollin", 59.34, 18.08))

        val houses = HousesProjection(feed)

        houses.size shouldBe 2
        houses.inCell(STOCKHOLM_Z8, someDay, 10).houses.map { it.name.value }.sorted() shouldBe
            listOf("Hollin", "Ravenscar")
    }

    "folding the same event twice leaves one house, because a feed delivers at least once" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        val twice = founded("Ravenscar", 59.33, 18.07)

        feed.deliver(twice)
        feed.deliver(twice)

        houses.size shouldBe 1
        houses.inCell(STOCKHOLM_Z8, someDay, 10).houses shouldHaveSize 1
    }

    "what a house is given reaches its row, so the owner is told wherever they are looking" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        val ravenscar = founded("Ravenscar", 59.33, 18.07)
        feed.deliver(ravenscar)

        feed.deliver(HouseResourceGranted(ravenscar.houseId, Resource.WEALTH, 120, someDay, noon), version = 2)

        val row = houses.ofPlayer(ravenscar.player)!!
        row.stockOf(Resource.WEALTH).at(noon) shouldBe 120
        row.version shouldBe 2
    }

    "a pledge reaches the row as a pledge, and releasing it takes it off again" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        val ravenscar = founded("Ravenscar", 59.33, 18.07)
        val glass = PledgeId(UUID.randomUUID())
        feed.deliver(ravenscar)
        feed.deliver(HouseResourceGranted(ravenscar.houseId, Resource.REASON, 100, someDay, noon), version = 2)

        feed.deliver(
            HouseResourcePledged(ravenscar.houseId, glass, Resource.REASON, 35, WorldTime(455205), "glass", someDay, noon),
            version = 3,
        )

        houses.ofPlayer(ravenscar.player)!!.pledgedOf(Resource.REASON) shouldBe 35

        feed.deliver(HouseResourceReleased(ravenscar.houseId, glass, WorldTime(455205), noon), version = 4)

        val freed = houses.ofPlayer(ravenscar.player)!!
        freed.pledgedOf(Resource.REASON) shouldBe 0
        freed.stockOf(Resource.REASON).at(noon) shouldBe 100
    }

    "a change to what a house has tells the watchers, so the fan-out carries it without new plumbing" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        val ravenscar = founded("Ravenscar", 59.33, 18.07)
        feed.deliver(ravenscar)
        val heard = mutableListOf<Boolean>()
        houses.watch { heard += it.appeared }

        feed.deliver(HouseResourceGranted(ravenscar.houseId, Resource.WEALTH, 10, someDay, noon), version = 2)

        // Told, and told that it is not a new house: an appearance would redraw it on every map.
        heard shouldBe listOf(false)
    }

    "a founding written before a resource existed is read with an empty stock of it" {
        val feed = HandFed()
        val houses = HousesProjection(feed)
        val founding = founded("Ravenscar", 59.33, 18.07)
        feed.deliver(founding.copy(resources = founding.resources - Resource.PIETY))

        val row = houses.inCell(STOCKHOLM_Z10, someDay, 10).houses.single()
        row.stockOf(Resource.PIETY) shouldBe Stock(0, 0.0, founding.recordedAt)
    }
})
