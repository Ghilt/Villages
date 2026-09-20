package villages.projections

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import villages.application.EventFeed
import villages.application.Start
import villages.application.StoredEvent
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.HouseEvent
import villages.domain.HouseFounded
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

/** A feed that delivers what it is handed, and can hand over what came before a subscriber arrived. */
private class Chronicle : EventFeed {
    private val stored = mutableListOf<StoredEvent>()
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        if (from == Start.FROM_THE_BEGINNING) {
            stored.forEach(subscriber)
        }
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    fun deliver(nth: Int) {
        val record = StoredEvent(
            id = "e-$nth",
            type = "villages.house.founded.v1",
            stream = "house:$nth",
            streamVersion = 1,
            time = Instant.parse("2026-09-04T12:00:00Z"),
            data = "{}",
            correlationId = "c-$nth",
            causationId = "c-$nth",
            event = founding(nth),
        )
        stored += record
        subscribers.toList().forEach { it(record) }
    }
}

private fun founding(nth: Int): HouseEvent = HouseFounded(
    houseId = HouseId(UUID.nameUUIDFromBytes("house-$nth".toByteArray())),
    player = PlayerId(UUID.nameUUIDFromBytes("player-$nth".toByteArray())),
    name = HouseName("House $nth"),
    seat = Location(59.33, 18.07),
    significance = Significance(20.0),
    banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
    resources = emptyStocks(Instant.parse("2026-09-04T12:00:00Z")),
    worldTime = WorldTime(454901),
    recordedAt = Instant.parse("2026-09-04T12:00:00Z"),
)

class RecentEventsProjectionSpec : StringSpec({

    "what was stored before a reader arrived is there for it to read" {
        val feed = Chronicle()
        feed.deliver(1)
        feed.deliver(2)

        val recent = RecentEventsProjection(feed)

        recent.latest(10).map { it.id } shouldBe listOf("e-1", "e-2")
    }

    "and what happens after it arrived is added to the end" {
        val feed = Chronicle()
        val recent = RecentEventsProjection(feed)

        feed.deliver(1)
        feed.deliver(2)

        recent.latest(10).map { it.id } shouldBe listOf("e-1", "e-2")
    }

    "oldest first, so a reader is handed them in the order they happened" {
        val feed = Chronicle()
        val recent = RecentEventsProjection(feed)
        (1..5).forEach(feed::deliver)

        recent.latest(3).map { it.id } shouldBe listOf("e-3", "e-4", "e-5")
    }

    "only the end of the chronicle is kept, because a read model that grows with the world is a leak" {
        val feed = Chronicle()
        val recent = RecentEventsProjection(feed, most = 4)

        (1..10).forEach(feed::deliver)

        recent.size shouldBe 4
        recent.latest(100).map { it.id } shouldBe listOf("e-7", "e-8", "e-9", "e-10")
    }

    "asking for more than is held is answered with what is held" {
        val feed = Chronicle()
        val recent = RecentEventsProjection(feed)
        feed.deliver(1)

        recent.latest(100) shouldHaveSize 1
    }

    "asking for none, or for less than none, is answered with none" {
        val feed = Chronicle()
        val recent = RecentEventsProjection(feed)
        feed.deliver(1)

        recent.latest(0).shouldBeEmpty()
        recent.latest(-3).shouldBeEmpty()
    }

    "a reset one has forgotten them, because the world they happened in has been emptied" {
        val feed = Chronicle()
        val recent = RecentEventsProjection(feed)
        feed.deliver(1)

        recent.reset()

        recent.latest(10).shouldBeEmpty()
        recent.size shouldBe 0
    }

    "one that has stopped hears nothing more" {
        val feed = Chronicle()
        val recent = RecentEventsProjection(feed)
        recent.close()

        feed.deliver(1)

        recent.latest(10).shouldBeEmpty()
    }
})
