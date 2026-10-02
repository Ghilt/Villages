package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf

/** The house: the key figures a house holds. The fixtures are HouseFixtures.kt. */
class HouseKeyFiguresSpec : StringSpec({

    "a house takes a key figure in, and holds them in the order it took them" {
        val events = HouseDecider.decide(TakeKeyFigure(ravenscar.houseId, figure(1), day, noon), founded())

        val gained = events.single().shouldBeInstanceOf<HouseGainedKeyFigure>()
        gained.characterId shouldBe figure(1)
        holding(3).shouldBeInstanceOf<House.Founded>().keyFigures shouldBe listOf(figure(1), figure(2), figure(3))
    }

    "the same character is never taken in twice" {
        shouldThrow<HouseError.AlreadyAKeyFigure> {
            HouseDecider.decide(TakeKeyFigure(ravenscar.houseId, figure(1), day, noon), holding(1))
        }
    }

    "a house holds nine key figures, and a tenth is refused" {
        holding(HouseDecider.MOST_KEY_FIGURES).shouldBeInstanceOf<House.Founded>().keyFigures shouldHaveSize 9
        shouldThrow<HouseError.TooManyKeyFigures> {
            HouseDecider.decide(TakeKeyFigure(ravenscar.houseId, figure(10), day, noon), holding(9))
        }
    }

    "a house that was never founded holds nobody" {
        shouldThrow<HouseError.NoSuchHouse> {
            HouseDecider.decide(TakeKeyFigure(ravenscar.houseId, figure(1), day, noon), HouseDecider.initial)
        }
    }

    "a key figure lost leaves the house, and nobody can be lost who was never held" {
        val events = HouseDecider.decide(LoseKeyFigure(ravenscar.houseId, figure(2), day, noon), holding(3))

        val lost = events.single().shouldBeInstanceOf<HouseLostKeyFigure>()
        val after = events.fold(holding(3), HouseDecider::evolve).shouldBeInstanceOf<House.Founded>()
        lost.characterId shouldBe figure(2)
        after.keyFigures shouldBe listOf(figure(1), figure(3))
        shouldThrow<HouseError.NoSuchKeyFigure> {
            HouseDecider.decide(LoseKeyFigure(ravenscar.houseId, figure(4), day, noon), holding(3))
        }
    }

    "a place freed by a loss can be taken again" {
        val nine = holding(9)
        val eight = HouseDecider.decide(LoseKeyFigure(ravenscar.houseId, figure(5), day, noon), nine).fold(nine, HouseDecider::evolve)

        HouseDecider.decide(TakeKeyFigure(ravenscar.houseId, figure(10), day, noon), eight) shouldHaveSize 1
    }

    "acting through a key figure writes nothing, and acting through anyone else is refused" {
        HouseDecider.decide(ActThrough(ravenscar.houseId, figure(1)), holding(1)) shouldHaveSize 0
        shouldThrow<HouseError.NoSuchKeyFigure> { HouseDecider.decide(ActThrough(ravenscar.houseId, figure(2)), holding(1)) }
        shouldThrow<HouseError.NoSuchHouse> { HouseDecider.decide(ActThrough(ravenscar.houseId, figure(1)), HouseDecider.initial) }
    }

    "asking for room writes nothing while there is some, and is refused when all nine places are taken" {
        HouseDecider.decide(CheckRoomForKeyFigure(ravenscar.houseId), holding(8)) shouldHaveSize 0
        shouldThrow<HouseError.TooManyKeyFigures> { HouseDecider.decide(CheckRoomForKeyFigure(ravenscar.houseId), holding(9)) }
    }
})
