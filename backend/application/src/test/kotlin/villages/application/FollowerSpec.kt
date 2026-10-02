package villages.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import java.util.UUID

/** A feed of bare envelopes, which hands over what came before to whoever starts from the beginning. */
private class Envelopes : EventFeed {
    private val stored = mutableListOf<StoredEvent>()
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        if (from == Start.FROM_THE_BEGINNING) {
            stored.toList().forEach(subscriber)
        }
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    fun write(id: String) {
        val event = villages.domain.HouseLostVision(
            houseId = villages.domain.HouseId(UUID(0, 1)),
            visionId = villages.domain.VisionId(UUID(0, 2)),
            worldTime = villages.domain.WorldTime(1000),
            recordedAt = java.time.Instant.EPOCH,
        )
        val written = StoredEvent(id, "villages.house.lostVision.v1", event.houseId.stream, 1, event.recordedAt, "{}", id, id, event)
        stored += written
        subscribers.toList().forEach { it(written) }
    }
}

/** A follower that writes down the ids it folds, and forgets them on a reset. */
private class Ids(feed: EventFeed) : Follower(feed) {
    val folded = mutableListOf<String>()

    override fun apply(stored: StoredEvent) {
        folded += stored.id
    }

    override fun reset() {
        folded.clear()
    }
}

class FollowerSpec : StringSpec({

    "nothing is folded until it is started, and then the history first and what follows as it comes" {
        val feed = Envelopes()
        feed.write("first")
        val ids = Ids(feed)

        ids.folded.shouldBeEmpty()

        ids.start()
        feed.write("second")

        ids.folded shouldBe listOf("first", "second")
    }

    "a follower is started once, because two subscriptions would fold every event twice" {
        val ids = Ids(Envelopes()).started()

        shouldThrow<IllegalStateException> { ids.start() }
    }

    "closed, it hears nothing more, and closing one never started is nothing" {
        val feed = Envelopes()
        val ids = Ids(feed).started()

        ids.close()
        feed.write("after")
        Ids(feed).close()

        ids.folded.shouldBeEmpty()
    }
})
