package villages.occurrent

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.application.StoredEvent
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

    "a command run through the port is stored as its catalogued type and delivered on the feed" {
        InMemoryWorld().use { world ->
            val delivered = mutableListOf<StoredEvent>()
            val arrived = CountDownLatch(1)
            world.feed.subscribe { delivered += it; arrived.countDown() }.use {
                world.executor.execute(ravenscar)

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

    "the decider's refusal comes back through the port as itself" {
        InMemoryWorld().use { world ->
            world.executor.execute(ravenscar)

            shouldThrow<HouseError.AlreadyFounded> { world.executor.execute(ravenscar) }
            world.store.read(ravenscar.houseId.stream).events().count() shouldBe 1
        }
    }

    "a closed feed hears nothing more" {
        InMemoryWorld().use { world ->
            var heard = 0
            world.feed.subscribe { heard += 1 }.close()

            world.executor.execute(ravenscar)
            Thread.sleep(200)

            heard shouldBe 0
        }
    }
})
