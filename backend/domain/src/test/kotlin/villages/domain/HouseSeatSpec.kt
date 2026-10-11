package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.types.shouldBeInstanceOf

/** The house: which of its holdings is its seat. The fixtures are HouseFixtures.kt. See decision record 0092. */
class HouseSeatSpec : StringSpec({
    val castle = StructureId.seatOf(ravenscar.houseId)

    "a house names its founding castle its seat, and is seated in it since" {
        val events = HouseDecider.decide(NameSeat(ravenscar.houseId, castle, day, noon), founded())

        events.single() shouldBe HouseNamedSeat(ravenscar.houseId, castle, day, noon)
        events.fold(founded(), HouseDecider::evolve).shouldBeInstanceOf<House.Founded>().seatedIn shouldBe castle
    }

    "it names its seat once, whatever is heard again, and only a house that exists names one" {
        val seated = HouseDecider.decide(NameSeat(ravenscar.houseId, castle, day, noon), founded()).fold(founded(), HouseDecider::evolve)

        shouldThrow<HouseError.SeatNamedBefore> { HouseDecider.decide(NameSeat(ravenscar.houseId, castle, day, noon), seated) }
        shouldThrow<HouseError.NoSuchHouse> { HouseDecider.decide(NameSeat(ravenscar.houseId, castle, day, noon), HouseDecider.initial) }
    }

    "the founding castle's id is the house's own, and no other house's" {
        StructureId.seatOf(ravenscar.houseId) shouldBe castle
        StructureId.seatOf(HouseId.of(PlayerId(java.util.UUID.randomUUID()))) shouldNotBe castle
    }

    "a house loses the seat it has, plays on without one, and loses it once" {
        val seated = HouseDecider.decide(NameSeat(ravenscar.houseId, castle, day, noon), founded()).fold(founded(), HouseDecider::evolve)

        val lost = HouseDecider.decide(LoseSeat(ravenscar.houseId, castle, day, noon), seated)
        val seatless = lost.fold(seated, HouseDecider::evolve)

        lost.single() shouldBe HouseLostSeat(ravenscar.houseId, castle, day, noon)
        seatless.shouldBeInstanceOf<House.Founded>().seatedIn shouldBe null
        shouldThrow<HouseError.NoSeat> { HouseDecider.decide(LoseSeat(ravenscar.houseId, castle, day, noon), seatless) }
        shouldThrow<HouseError.SeatNamedBefore> { HouseDecider.decide(NameSeat(ravenscar.houseId, castle, day, noon), seatless) }
    }
})
