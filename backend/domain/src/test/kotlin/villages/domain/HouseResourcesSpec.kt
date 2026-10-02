package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.util.UUID

/** The house: what a house has, and what it spends and pledges. The fixtures are HouseFixtures.kt. */
class HouseResourcesSpec : StringSpec({

    "a house given a resource has that much more of it" {
        val house = after(granting(amount = 120))

        house.stockOf(Resource.WEALTH).at(noon) shouldBe 120
        house.freeOf(Resource.WEALTH, noon) shouldBe 120
    }

    "spending takes it away again, and nothing else with it" {
        val house = after(granting(amount = 120), spending(amount = 50))

        house.stockOf(Resource.WEALTH).at(noon) shouldBe 70
        house.stockOf(Resource.PIETY).at(noon) shouldBe 0
    }

    "a house cannot spend what it has not got" {
        shouldThrow<HouseError.NotEnoughFree> { HouseDecider.decide(spending(amount = 1), standing) }
    }

    "nothing can be granted, spent or pledged to a house nobody has founded" {
        shouldThrow<HouseError.NoSuchHouse> { HouseDecider.decide(granting(), HouseDecider.initial) }
        shouldThrow<HouseError.NoSuchHouse> { HouseDecider.decide(spending(), HouseDecider.initial) }
        shouldThrow<HouseError.NoSuchHouse> { HouseDecider.decide(pledging(), HouseDecider.initial) }
    }

    "an amount is more than nothing, whichever way it is meant" {
        shouldThrow<HouseError.InvalidAmount> { HouseDecider.decide(granting(amount = 0), standing) }
        shouldThrow<HouseError.InvalidAmount> { HouseDecider.decide(spending(amount = -5), standing) }
    }

    "a pledge holds part of a stock without taking any of it away" {
        val house = after(granting(Resource.REASON, 100), pledging(amount = 35))

        house.stockOf(Resource.REASON).at(noon) shouldBe 100
        house.pledgedOf(Resource.REASON) shouldBe 35
        house.freeOf(Resource.REASON, noon) shouldBe 65
    }

    "what is pledged cannot be spent out from under the pledge" {
        val house = after(granting(Resource.REASON, 100), pledging(amount = 35))

        shouldThrow<HouseError.NotEnoughFree> {
            HouseDecider.decide(spending(Resource.REASON, 66), house)
        }
        // Sixty-five is exactly what is free, so it goes through and the pledge is untouched.
        val spent = after(granting(Resource.REASON, 100), pledging(amount = 35), spending(Resource.REASON, 65))
        spent.freeOf(Resource.REASON, noon) shouldBe 0
        spent.pledgedOf(Resource.REASON) shouldBe 35
    }

    "the same reason cannot be pledged twice" {
        val house = after(granting(Resource.REASON, 100), pledging(amount = 60))

        shouldThrow<HouseError.NotEnoughFree> {
            HouseDecider.decide(pledging(amount = 60, id = PledgeId(UUID.randomUUID())), house)
        }
    }

    "releasing a pledge gives back exactly what it held, and nothing is added anywhere" {
        val house = after(granting(Resource.REASON, 100), pledging(amount = 35))

        val freed = HouseDecider.decide(ReleasePledge(house.id, glass, later, noon), house)
            .fold(house, HouseDecider::evolve)
            .shouldBeInstanceOf<House.Founded>()

        freed.pledges.shouldHaveSize(0)
        freed.pledgedOf(Resource.REASON) shouldBe 0
        freed.freeOf(Resource.REASON, noon) shouldBe 100
        freed.stockOf(Resource.REASON).at(noon) shouldBe 100
    }

    "a pledge nobody made cannot be released" {
        shouldThrow<HouseError.NoSuchPledge> {
            HouseDecider.decide(ReleasePledge(house, glass, later, noon), standing)
        }
    }

    "a pledge comes back after it is made, and is refused if it does not" {
        val held = after(granting(Resource.REASON, 100))

        shouldThrow<HouseError.InvalidPledge> { HouseDecider.decide(pledging(until = day), held) }
    }

    "the gate reads what is free and takes nothing, which is what makes it a gate" {
        val house = after(granting(Resource.NATURAL_DOMAIN, 12))

        house.has(Resource.NATURAL_DOMAIN, 12, noon) shouldBe true
        house.has(Resource.NATURAL_DOMAIN, 13, noon) shouldBe false
        // Asking took none of it: that is the whole difference between a gate and a price.
        house.stockOf(Resource.NATURAL_DOMAIN).at(noon) shouldBe 12
    }
})
