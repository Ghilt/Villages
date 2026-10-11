package villages.occurrent

import io.cloudevents.core.builder.CloudEventBuilder
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import villages.application.Provenance
import villages.application.Unreadable
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.FoundHouse
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Tincture
import villages.domain.WorldTime
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/**
 * What a world holds that this code cannot read, found by reading all of it once: here in memory, where an event of
 * a shape the code has since changed is the only kind there can be. The store that cannot read an event back at all
 * is MongoDB's, in `MongoWorldDockerSpec`. See decision record 0036.
 */
class UnreadableSpec : StringSpec({
    val ravenscar = FoundHouse(
        houseId = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a")),
        player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d")),
        name = HouseName("Ravenscar"),
        seat = Location(59.33, 18.07),
        banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
        worldTime = WorldTime(454901),
        recordedAt = Instant.parse("2026-10-11T12:00:00Z"),
    )
    val sent = Provenance.startedBy(UUID.fromString("1c000001-0000-4000-8000-00000000000a"))

    /** A founding as older code might have written it, before the fields it has now. */
    val oldFounding = CloudEventBuilder.v1()
        .withId("f0f0f0f0-0000-4000-8000-000000000001")
        .withSource(Events.SOURCE)
        .withType("villages.house.founded.v1")
        .withTime(OffsetDateTime.of(2026, 9, 1, 12, 0, 0, 0, ZoneOffset.UTC))
        .withData("application/json", """{"houseId":"f0f0f0f0-0000-4000-8000-0000000000aa","aFieldNoLongerKept":1}""".toByteArray())
        .build()

    "a world this code wrote all of can all be read, and says how much it read" {
        InMemoryWorld().use { world ->
            world.executor.execute(ravenscar, sent)

            world.unreadable() shouldBe Unreadable(events = 0, of = 1)
        }
    }

    "an event of a shape the code has since changed is counted, and the first is named by its type and stream" {
        InMemoryWorld().use { world ->
            world.executor.execute(ravenscar, sent)
            world.store.write("house:f0f0f0f0-0000-4000-8000-0000000000aa", listOf(oldFounding))

            val unreadable = world.unreadable()

            unreadable.events shouldBe 1
            unreadable.of shouldBe 2
            unreadable.none shouldBe false
            unreadable.first!! shouldContain "villages.house.founded.v1 on house:f0f0f0f0-0000-4000-8000-0000000000aa"
        }
    }

    "a wipe leaves nothing unreadable, without reading the store again" {
        InMemoryWorld().use { world ->
            world.store.write("house:f0f0f0f0-0000-4000-8000-0000000000aa", listOf(oldFounding))
            world.unreadable().events shouldBe 1

            world.wipe() shouldBe 1

            world.unreadable() shouldBe Unreadable.NONE
        }
    }
})
