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
    val house = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"))
    val player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val day = WorldTime(454901)
    val sable = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT)
    val or = Banner(Tincture.OR, Division.PLAIN, null, Charge.TOWER, Tincture.GULES)

    val ravenscar = FoundHouse(
        houseId = house,
        player = player,
        name = HouseName("Ravenscar"),
        seat = Location(59.33, 18.07),
        banner = sable,
        worldTime = day,
        recordedAt = noon,
    )

    val northern = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000001"))
    val southern = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000002"))
    val whereToSettle = Choice(
        id = ChoiceId(UUID.fromString("aa000000-0000-4000-8000-00000000c401")),
        prompt = "Where shall the house raise its seat?",
        options = listOf(
            Option(northern, "Ravenscar", "On the northern shore.", Effect.FoundAt(Location(59.33, 18.07), HouseName("Ravenscar"), sable)),
            Option(southern, "Hollin", "Under the southern hills.", Effect.FoundAt(Location(47.5, 19.05), HouseName("Hollin"), or)),
        ),
    )
    val giving = GiveChoice(house, player, whereToSettle, day, noon)
    fun taking(choice: ChoiceId = whereToSettle.id, option: OptionId = southern) =
        TakeAction(house, player, choice, option, day, noon)

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
})
