package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.time.Instant
import java.util.UUID

class HouseDeciderSpec : StringSpec({
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

    "founding a house that does not exist yields one HouseFounded, with a significance and an empty treasury" {
        val events = HouseDecider.decide(ravenscar, HouseDecider.initial)

        events shouldHaveSize 1
        val founded = events.single().shouldBeInstanceOf<HouseFounded>()
        founded.houseId shouldBe ravenscar.houseId
        founded.name shouldBe HouseName("Ravenscar")
        founded.seat shouldBe ravenscar.seat
        founded.significance shouldBe HouseDecider.FOUNDING_SIGNIFICANCE
        founded.treasury shouldBe Treasury(0, HouseDecider.FOUNDING_RATE, noon)
        founded.worldTime shouldBe ravenscar.worldTime
        founded.recordedAt shouldBe noon
    }

    "founding it again is refused" {
        val once = HouseDecider.fold(HouseDecider.decide(ravenscar, HouseDecider.initial))

        shouldThrow<HouseError.AlreadyFounded> { HouseDecider.decide(ravenscar, once) }
    }

    "the state folded from the events is the house that was founded" {
        val house = HouseDecider.fold(HouseDecider.decide(ravenscar, HouseDecider.initial))

        val founded = house.shouldBeInstanceOf<House.Founded>()
        founded.id shouldBe ravenscar.houseId
        founded.seat shouldBe ravenscar.seat
        founded.banner shouldBe ravenscar.banner
        founded.treasury.at(noon.plusSeconds(90)) shouldBe 90
    }

    "nothing happens to a house nobody has founded" {
        HouseDecider.fold(emptyList()) shouldBe House.NotFounded
    }
})
