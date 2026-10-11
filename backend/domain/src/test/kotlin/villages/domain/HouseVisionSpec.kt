package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf

/** The house: the vision a house is given outright. The fixtures are HouseFixtures.kt. */
class HouseVisionSpec : StringSpec({

    "a house given vision of a place sees a circle as big as Mallorca about it, from that day on" {
        val events = HouseDecider.decide(GiveVision(ravenscar.houseId, vision(1), gotland, day, noon), founded())

        events.single() shouldBe HouseGainedVision(ravenscar.houseId, vision(1), gotland, Vision.MALLORCA, null, day, noon)
        give(founded(), 1).shouldBeInstanceOf<House.Founded>().visions shouldBe listOf(vision(1))
        Vision.MALLORCA shouldBe 34.0
    }

    "a vision taken away is gone, and one never given cannot be taken" {
        val given = give(give(founded(), 1), 2)
        val events = HouseDecider.decide(TakeVision(ravenscar.houseId, vision(1), day, noon), given)

        events.single() shouldBe HouseLostVision(ravenscar.houseId, vision(1), day, noon)
        events.fold(given, HouseDecider::evolve).shouldBeInstanceOf<House.Founded>().visions shouldBe listOf(vision(2))
        shouldThrow<HouseError.NoSuchVision> {
            HouseDecider.decide(TakeVision(ravenscar.houseId, vision(3), day, noon), given)
        }
    }

    "vision is given only to a house that exists, and never twice under one name" {
        shouldThrow<HouseError.NoSuchHouse> {
            HouseDecider.decide(GiveVision(ravenscar.houseId, vision(1), gotland, day, noon), HouseDecider.initial)
        }
        shouldThrow<HouseError.InvalidVision> {
            HouseDecider.decide(GiveVision(ravenscar.houseId, vision(1), gotland, day, noon), give(founded(), 1))
        }
    }
})
