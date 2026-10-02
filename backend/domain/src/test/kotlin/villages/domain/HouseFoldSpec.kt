package villages.domain

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.shuffle
import io.kotest.property.checkAll

/**
 * A house's fold never throws, whatever order its events come in, and a replay comes to the house the decisions
 * left. `TESTING.md` asks this of every stream's fold, and `Decider` says why: a fold that throws on one event
 * makes the stream unreadable, and every later command on that house fails with it.
 */
class HouseFoldSpec : StringSpec({

    // A house's life, decided command by command, so that every event in it is one the decider really writes.
    val commands = listOf(
        ravenscar,
        granting(amount = 100),
        granting(Resource.REASON, 50),
        spending(amount = 30),
        pledging(amount = 20),
        ReleasePledge(house, glass, day, noon),
        GiveChoice(house, player, aGift, day, noon),
        TakeAction(house, player, aGift.id, purse, day, noon),
        TakeKeyFigure(house, figure(1), day, noon),
        TakeKeyFigure(house, figure(2), day, noon),
        LoseKeyFigure(house, figure(1), day, noon),
        GiveVision(house, vision(1), gotland, day, noon),
        GiveVision(house, vision(2), gotland, day, noon),
        TakeVision(house, vision(1), day, noon),
        offering(quay),
        stepping("accept"),
        stepping("thanks"),
        offering(herFirst),
        herDeath,
    )
    val (lived, life) = commands.fold(HouseDecider.initial to emptyList<HouseEvent>()) { (state, written), command ->
        val decided = HouseDecider.decide(command, state)
        decided.fold(state, HouseDecider::evolve) to written + decided
    }

    "a replay of a house's events comes to the house its decisions left" {
        HouseDecider.fold(life) shouldBe lived
    }

    "folding a house's events in any order never throws" {
        checkAll(Arb.shuffle(life)) { shuffled -> HouseDecider.fold(shuffled) }
    }
})
