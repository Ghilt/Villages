package villages.occurrent

import io.cloudevents.CloudEvent
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import org.occurrent.eventstore.api.blocking.EventStore
import org.occurrent.eventstore.api.blocking.EventStream
import villages.application.Provenance
import villages.application.Start
import villages.application.StoredEvent
import villages.application.WriteConflict
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.FoundHouse
import villages.domain.HouseError
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Tincture
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class InMemoryWorldSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val ravenscar = FoundHouse(
        houseId = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a")),
        player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d")),
        name = HouseName("Ravenscar"),
        seat = Location(59.33, 18.07),
        banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
        worldTime = WorldTime(454901),
        recordedAt = noon,
    )

    val hollin = ravenscar.copy(
        houseId = HouseId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d")),
        name = HouseName("Hollin"),
    )

    val commandId = UUID.fromString("1c000001-0000-4000-8000-00000000000a")
    val story = UUID.fromString("57000000-0000-4000-8000-0000000000ff")
    val sent = Provenance(commandId = commandId, correlationId = story)

    "a command run through the port is stored as its catalogued type and delivered on the feed" {
        InMemoryWorld().use { world ->
            val delivered = mutableListOf<StoredEvent>()
            val arrived = CountDownLatch(1)
            world.feed.subscribe(Start.FROM_NOW) { delivered += it; arrived.countDown() }.use {
                world.executor.execute(ravenscar, sent)

                arrived.await(5, TimeUnit.SECONDS) shouldBe true
                val stored = delivered.single()
                stored.type shouldBe "villages.house.founded.v1"
                stored.stream shouldBe "house:6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"
                stored.streamVersion shouldBe 1
                stored.time shouldBe noon
                stored.event.shouldBeInstanceOf<HouseFounded>().name shouldBe HouseName("Ravenscar")
                stored.data.contains("\"significance\":20.0") shouldBe true
            }
        }
    }

    "and it carries where it came from: its own id, the story it belongs to, and what caused it" {
        InMemoryWorld().use { world ->
            val delivered = mutableListOf<StoredEvent>()
            val arrived = CountDownLatch(1)
            world.feed.subscribe(Start.FROM_NOW) { delivered += it; arrived.countDown() }.use {
                world.executor.execute(ravenscar, sent)

                arrived.await(5, TimeUnit.SECONDS) shouldBe true
                val stored = delivered.single()
                stored.correlationId shouldBe story.toString()
                stored.causationId shouldBe commandId.toString()
                // The event id is the store's own, and is neither of those: three ids, three questions.
                UUID.fromString(stored.id) shouldBe UUID.fromString(stored.id)
                (stored.id == stored.causationId) shouldBe false
            }
        }
    }

    "the provenance is on the envelope and not in the data, which stays the event's own fields" {
        InMemoryWorld().use { world ->
            world.executor.execute(ravenscar, sent)

            val written = world.store.read(ravenscar.houseId.stream).eventList().single()
            written.getExtension(HouseEvents.CORRELATION_ID) shouldBe story.toString()
            written.getExtension(HouseEvents.CAUSATION_ID) shouldBe commandId.toString()
            String(written.data!!.toBytes()).contains("correlation") shouldBe false
        }
    }

    "the decider's refusal comes back through the port as itself" {
        InMemoryWorld().use { world ->
            world.executor.execute(ravenscar, sent)

            shouldThrow<HouseError.AlreadyFounded> { world.executor.execute(ravenscar, sent) }
            world.store.read(ravenscar.houseId.stream).events().count() shouldBe 1
        }
    }

    "a stream that will not stand still is retried, and then given up on as a conflict" {
        InMemoryWorld().use { world ->
            // A store whose reads disagree with its writes about where the stream stands, which is what
            // losing a race looks like from inside the executor: the write condition is never fulfilled.
            val contested = object : EventStore by world.store {
                override fun read(streamId: String): EventStream<CloudEvent> {
                    val held = world.store.read(streamId)
                    return object : EventStream<CloudEvent> by held {
                        override fun version(): Long = held.version() + 1
                    }
                }
            }
            val executor = OccurrentHouseCommandExecutor(contested, world.converter)

            val conflict = shouldThrow<WriteConflict> { executor.execute(ravenscar, sent) }

            conflict.stream shouldBe ravenscar.houseId.stream
            world.store.read(ravenscar.houseId.stream).events().count() shouldBe 0
        }
    }

    "a closed feed hears nothing more" {
        InMemoryWorld().use { world ->
            var heard = 0
            world.feed.subscribe(Start.FROM_NOW) { heard += 1 }.close()

            world.executor.execute(ravenscar, sent)
            Thread.sleep(200)

            heard shouldBe 0
        }
    }

    "a feed from the beginning hands over what the store already holds, then what follows" {
        InMemoryWorld().use { world ->
            world.executor.execute(ravenscar, sent)

            val caughtUp = mutableListOf<StoredEvent>()
            val bothArrived = CountDownLatch(2)
            world.feed.subscribe(Start.FROM_THE_BEGINNING) { caughtUp += it; bothArrived.countDown() }.use {
                caughtUp.map { event -> event.stream } shouldBe listOf(ravenscar.houseId.stream)

                world.executor.execute(hollin, sent)

                bothArrived.await(5, TimeUnit.SECONDS) shouldBe true
                caughtUp.map { event -> event.stream } shouldBe
                    listOf(ravenscar.houseId.stream, hollin.houseId.stream)
            }
        }
    }

    "a feed from now hears nothing of what came before it" {
        InMemoryWorld().use { world ->
            world.executor.execute(ravenscar, sent)

            val heard = mutableListOf<StoredEvent>()
            world.feed.subscribe(Start.FROM_NOW) { heard += it }.use {
                Thread.sleep(200)

                heard.shouldBeEmpty()
            }
        }
    }

    "an event delivered twice is still one event, because the replay and the live feed may overlap" {
        InMemoryWorld().use { world ->
            world.executor.execute(ravenscar, sent)

            val heard = mutableListOf<StoredEvent>()
            world.feed.subscribe(Start.FROM_THE_BEGINNING) { heard += it }.use {
                // The subscription is live before the replay runs, so the store's one event could reach a
                // subscriber down both paths. Identity is what makes that harmless; see decision 0029.
                heard.map { it.id }.distinct() shouldBe heard.map { it.id }
                heard shouldHaveSize 1
            }
        }
    }
})
