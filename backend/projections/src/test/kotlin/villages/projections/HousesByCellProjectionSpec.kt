package villages.projections

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import villages.application.EventFeed
import villages.application.HouseRow
import villages.application.StoredEvent
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Significance
import villages.domain.Tincture
import villages.domain.Treasury
import java.time.Instant
import java.util.UUID

/** A feed that delivers what it is handed, when it is handed it. */
private class HandFed : EventFeed {
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun subscribe(subscriber: (StoredEvent) -> Unit): AutoCloseable {
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    fun deliver(event: HouseFounded, version: Long = 1) {
        val stored = StoredEvent(
            id = UUID.randomUUID().toString(),
            type = "villages.house.founded.v1",
            stream = event.houseId.stream,
            streamVersion = version,
            time = event.at,
            data = "{}",
            event = event,
        )
        subscribers.toList().forEach { it(stored) }
    }
}

private val noon = Instant.parse("2026-09-04T12:00:00Z")

private fun founded(
    name: String,
    lat: Double,
    lon: Double,
    significance: Double = 20.0,
    at: Instant = noon,
) = HouseFounded(
    houseId = HouseId(UUID.nameUUIDFromBytes(name.toByteArray())),
    player = PlayerId(UUID.randomUUID()),
    name = HouseName(name),
    seat = Location(lat, lon),
    significance = Significance(significance),
    banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
    treasury = Treasury(0, 1.0, at),
    at = at,
)

/** Stockholm, before the warp: the shared vector every zoom of it is known for. */
private const val STOCKHOLM_Z10 = "1200312213"
private const val STOCKHOLM_Z8 = "12003122"
private const val STOCKHOLM_Z4 = "1200"

class HousesByCellProjectionSpec : StringSpec({

    "a founded house is in its own cell, and in every cell above it down to where its significance runs out" {
        val feed = HandFed()
        val houses = HousesByCellProjection(feed)
        feed.deliver(founded("Ravenscar", 59.33, 18.07, significance = 20.0))

        // Twenty is worth drawing from zoom eight in, and not from further out.
        houses.inCell(STOCKHOLM_Z10, noon, 10).houses.map { it.name } shouldBe listOf(HouseName("Ravenscar"))
        houses.inCell(STOCKHOLM_Z8, noon, 10).houses shouldHaveSize 1
        houses.inCell(STOCKHOLM_Z8.take(7), noon, 10).houses.shouldBeEmpty()
        houses.inCell(STOCKHOLM_Z4, noon, 10).houses.shouldBeEmpty()
        houses.inCell("", noon, 10).houses.shouldBeEmpty()
    }

    "a legendary thing is drawn from the whole world" {
        val feed = HandFed()
        val houses = HousesByCellProjection(feed)
        feed.deliver(founded("St John's", 59.33, 18.07, significance = 100.0))

        houses.inCell("", noon, 10).houses shouldHaveSize 1
        houses.inCell(STOCKHOLM_Z4, noon, 10).houses shouldHaveSize 1
    }

    "a house is not in a cell its seat does not fall in" {
        val feed = HandFed()
        val houses = HousesByCellProjection(feed)
        feed.deliver(founded("Ravenscar", 59.33, 18.07))

        // Cape Town's cell, at the same zoom.
        houses.inCell("30023103", noon, 10).houses.shouldBeEmpty()
    }

    "a house exists from its founding onward, and not before" {
        val feed = HandFed()
        val houses = HousesByCellProjection(feed)
        feed.deliver(founded("Ravenscar", 59.33, 18.07, at = noon))

        houses.inCell(STOCKHOLM_Z8, noon.minusSeconds(1), 10).houses.shouldBeEmpty()
        houses.inCell(STOCKHOLM_Z8, noon, 10).houses shouldHaveSize 1
        houses.inCell(STOCKHOLM_Z8, noon.plusSeconds(3600 * 24 * 365), 10).houses shouldHaveSize 1
    }

    "the most significant come first, and what will not fit is counted rather than lost" {
        val feed = HandFed()
        val houses = HousesByCellProjection(feed)
        feed.deliver(founded("Lesser", 59.33, 18.07, significance = 30.0))
        feed.deliver(founded("Greatest", 59.331, 18.071, significance = 90.0))
        feed.deliver(founded("Middling", 59.332, 18.072, significance = 60.0))

        val contents = houses.inCell(STOCKHOLM_Z8, noon, 2)

        contents.houses.map { it.name.value } shouldBe listOf("Greatest", "Middling")
        contents.omitted shouldBe 1
    }

    "a watcher hears each row as it is applied, and the read model counts what it applied" {
        val feed = HandFed()
        val houses = HousesByCellProjection(feed)
        val heard = mutableListOf<HouseRow>()
        houses.watch { heard += it }

        feed.deliver(founded("Ravenscar", 59.33, 18.07))
        feed.deliver(founded("Hollin", 59.41, 17.95))

        heard.map { it.name.value } shouldBe listOf("Ravenscar", "Hollin")
        heard.first().version shouldBe 1
        houses.inCell(STOCKHOLM_Z8, noon, 10).asOf shouldBe 2
        houses.size shouldBe 2
    }

    "a watcher that stopped hears nothing more" {
        val feed = HandFed()
        val houses = HousesByCellProjection(feed)
        val heard = mutableListOf<HouseRow>()
        houses.watch { heard += it }.close()

        feed.deliver(founded("Ravenscar", 59.33, 18.07))

        heard.shouldBeEmpty()
    }
})
