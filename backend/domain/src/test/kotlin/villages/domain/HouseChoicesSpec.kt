package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.util.UUID

/** The house: founding a house, the choice it is founded from, and a choice that grants or costs. The fixtures are HouseFixtures.kt. */
class HouseChoicesSpec : StringSpec({

    "founding a house that does not exist yields one HouseFounded, with a significance and a stock of everything" {
        val events = HouseDecider.decide(ravenscar, HouseDecider.initial)

        events shouldHaveSize 1
        val founded = events.single().shouldBeInstanceOf<HouseFounded>()
        founded.houseId shouldBe ravenscar.houseId
        founded.name shouldBe HouseName("Ravenscar")
        founded.seat shouldBe ravenscar.seat
        founded.significance shouldBe HouseDecider.FOUNDING_SIGNIFICANCE
        founded.resources shouldBe foundingStocks(noon)
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
        founded.stockOf(Resource.WEALTH).total shouldBe FOUNDING_WEALTH
    }

    "a house is founded with every resource standing still, because nothing generates income yet, and wealth enough to roll" {
        val house = HouseDecider.fold(HouseDecider.decide(ravenscar, HouseDecider.initial))

        val founded = house.shouldBeInstanceOf<House.Founded>()
        for (resource in Resource.entries) {
            withClue(resource) {
                val founding = if (resource == Resource.WEALTH) FOUNDING_WEALTH else 0L
                founded.stockOf(resource).total shouldBe founding
                founded.stockOf(resource).ratePerSecond shouldBe 0.0
                // Ninety seconds on and no more: the rate shape is carried, and it carries zero.
                founded.stockOf(resource).at(noon.plusSeconds(90)) shouldBe founding
            }
        }
    }

    "nothing happens to a house nobody has founded" {
        HouseDecider.fold(emptyList()) shouldBe House.NotFounded()
    }

    "a house with nothing to decide can be given a choice, and then has one" {
        val events = HouseDecider.decide(giving, HouseDecider.initial)

        val given = events.single().shouldBeInstanceOf<PlayerGivenChoice>()
        given.choice shouldBe whereToSettle
        // The whole choice is on the event, so the roads not taken are history too.
        given.choice.options.map { it.label } shouldBe listOf("Ravenscar", "Hollin")
        HouseDecider.fold(events).pending shouldBe whereToSettle
    }

    "a second choice is refused while one is still pending, because a house is asked one thing at a time" {
        val asked = HouseDecider.fold(HouseDecider.decide(giving, HouseDecider.initial))

        shouldThrow<HouseError.ChoicePending> { HouseDecider.decide(giving, asked) }
    }

    "a choice about where to found is refused once the house is founded" {
        val founded = HouseDecider.fold(HouseDecider.decide(ravenscar, HouseDecider.initial))

        shouldThrow<HouseError.AlreadyFounded> { HouseDecider.decide(giving, founded) }
    }

    "taking an option records the action and what it does, in that order and from one decision" {
        val asked = HouseDecider.fold(HouseDecider.decide(giving, HouseDecider.initial))

        val events = HouseDecider.decide(taking(), asked)

        events shouldHaveSize 2
        val action = events[0].shouldBeInstanceOf<PlayerTookAction>()
        action.choiceId shouldBe whereToSettle.id
        action.optionId shouldBe southern
        val founded = events[1].shouldBeInstanceOf<HouseFounded>()
        // The house is founded at what the option promised, and nowhere else.
        founded.seat shouldBe Location(47.5, 19.05)
        founded.name shouldBe HouseName("Hollin")
        founded.banner shouldBe or
    }

    "and the house is then founded with nothing left to decide" {
        val asked = HouseDecider.fold(HouseDecider.decide(giving, HouseDecider.initial))

        val after = HouseDecider.fold(HouseDecider.decide(giving, HouseDecider.initial) + HouseDecider.decide(taking(), asked))

        after.shouldBeInstanceOf<House.Founded>().name shouldBe HouseName("Hollin")
        after.pending shouldBe null
    }

    "taking an option when nothing was asked is refused" {
        shouldThrow<HouseError.NoChoicePending> { HouseDecider.decide(taking(), HouseDecider.initial) }
    }

    "answering a choice the house was not given is refused, which is what a stale parchment is" {
        val asked = HouseDecider.fold(HouseDecider.decide(giving, HouseDecider.initial))
        val somethingElse = ChoiceId(UUID.fromString("bb000000-0000-4000-8000-00000000c402"))

        shouldThrow<HouseError.NoSuchChoice> { HouseDecider.decide(taking(choice = somethingElse), asked) }
    }

    "taking an option the choice does not offer is refused" {
        val asked = HouseDecider.fold(HouseDecider.decide(giving, HouseDecider.initial))
        val nothingLikeIt = OptionId(UUID.fromString("cc000000-0000-4000-8000-000000000009"))

        shouldThrow<HouseError.NoSuchOption> { HouseDecider.decide(taking(option = nothingLikeIt), asked) }
    }

    "founding by other means settles a choice about where to found" {
        val asked = HouseDecider.fold(HouseDecider.decide(giving, HouseDecider.initial))

        // The debug button and the seed found directly. A parchment asking where to put a house that is
        // already standing is not a question, so it goes.
        val founded = HouseDecider.fold(HouseDecider.decide(giving, HouseDecider.initial) + HouseDecider.decide(ravenscar, asked))

        founded.shouldBeInstanceOf<House.Founded>().name shouldBe HouseName("Ravenscar")
        founded.pending shouldBe null
    }

    "a choice with too few options, or two options sharing an id, is not a choice" {
        val one = listOf(whereToSettle.options.first())

        shouldThrow<HouseError.InvalidChoice> { whereToSettle.copy(options = one) }
        shouldThrow<HouseError.InvalidChoice> { whereToSettle.copy(options = one + one) }
        shouldThrow<HouseError.InvalidChoice> { whereToSettle.copy(prompt = "  ") }
    }

    "replaying a stream gives the same state however it is folded, which is what makes a replay safe" {
        val stream = HouseDecider.decide(giving, HouseDecider.initial)
            .let { given -> given + HouseDecider.decide(taking(), HouseDecider.fold(given)) }

        val allAtOnce = HouseDecider.fold(stream)
        val oneAtATime = stream.fold(HouseDecider.initial, HouseDecider::evolve)

        allAtOnce shouldBe oneAtATime
        HouseDecider.fold(stream) shouldBe allAtOnce
    }

    "an option can grant, and taking it gives the house that much in the same decision as the action" {
        val asked = after(GiveChoice(house, player, aGift, day, noon))

        val events = HouseDecider.decide(TakeAction(house, player, aGift.id, purse, day, noon), asked)

        events.map { it::class } shouldBe listOf(PlayerTookAction::class, HouseResourceGranted::class)
        events[1] shouldBe HouseResourceGranted(house, Resource.WEALTH, 100, day, noon)
        val given = events.fold(asked, HouseDecider::evolve).shouldBeInstanceOf<House.Founded>()
        given.stockOf(Resource.WEALTH).at(noon) shouldBe 100
        given.pending shouldBe null
    }

    "an option can cost, and taking it spends that much from one decision, or is refused while the house cannot pay" {
        val toll = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000013"))
        val bridge = Choice(
            id = ChoiceId(UUID.fromString("aa000000-0000-4000-8000-00000000c403")),
            prompt = "The bridge-keeper asks a toll.",
            options = listOf(
                Option(toll, "Pay it", "Thirty in coin.", Effect.Spend(Resource.WEALTH, 30)),
                Option(letters, "Show him the letters", "Introductions at court.", Effect.Grant(Resource.INFLUENCE, 20)),
            ),
        )
        fun paying(state: House) = HouseDecider.decide(TakeAction(house, player, bridge.id, toll, day, noon), state)

        shouldThrow<HouseError.NotEnoughFree> { paying(after(GiveChoice(house, player, bridge, day, noon))) }
        shouldThrow<HouseError.NoSuchHouse> {
            HouseDecider.decide(GiveChoice(house, player, bridge, day, noon), HouseDecider.initial)
        }

        val rich = after(granting(amount = 50), GiveChoice(house, player, bridge, day, noon))
        val events = paying(rich)
        events.map { it::class } shouldBe listOf(PlayerTookAction::class, HouseResourceSpent::class)
        val paidFor = events.fold(rich, HouseDecider::evolve).shouldBeInstanceOf<House.Founded>()
        paidFor.stockOf(Resource.WEALTH).at(noon) shouldBe 20
    }

    "a choice that grants is refused to a house nobody has founded, as one that founds is refused to one that is" {
        shouldThrow<HouseError.NoSuchHouse> {
            HouseDecider.decide(GiveChoice(house, player, aGift, day, noon), HouseDecider.initial)
        }
    }

    "a choice whose every option costs is refused as it is given, since a house that cannot pay could never answer" {
        val dues = Choice(
            id = ChoiceId(UUID.fromString("aa000000-0000-4000-8000-00000000c403")),
            prompt = "The bishop asks for his dues.",
            options = listOf(
                Option(purse, "In coin", "Forty pieces.", Effect.Spend(Resource.WEALTH, 40)),
                Option(letters, "In kind", "Twenty of reason, for a season.", Effect.Spend(Resource.REASON, 20)),
            ),
        )
        shouldThrow<HouseError.InvalidChoice> { HouseDecider.decide(GiveChoice(house, player, dues, day, noon), standing) }

        val later = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000013"))
        val withAWayOut = dues.copy(options = dues.options + Option(later, "Not yet", "He can wait.", Effect.Grant(Resource.PIETY, 1)))
        HouseDecider.decide(GiveChoice(house, player, withAWayOut, day, noon), standing).single()
            .shouldBeInstanceOf<PlayerGivenChoice>()
    }
})
