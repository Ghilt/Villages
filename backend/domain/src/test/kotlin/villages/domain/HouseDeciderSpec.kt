package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
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

    "founding a house that does not exist yields one HouseFounded, with a significance and a stock of everything" {
        val events = HouseDecider.decide(ravenscar, HouseDecider.initial)

        events shouldHaveSize 1
        val founded = events.single().shouldBeInstanceOf<HouseFounded>()
        founded.houseId shouldBe ravenscar.houseId
        founded.name shouldBe HouseName("Ravenscar")
        founded.seat shouldBe ravenscar.seat
        founded.significance shouldBe HouseDecider.FOUNDING_SIGNIFICANCE
        founded.resources shouldBe emptyStocks(noon)
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
        founded.stockOf(Resource.WEALTH).total shouldBe 0
    }

    "a house is founded with every resource standing still, because nothing generates income yet" {
        val house = HouseDecider.fold(HouseDecider.decide(ravenscar, HouseDecider.initial))

        val founded = house.shouldBeInstanceOf<House.Founded>()
        for (resource in Resource.entries) {
            withClue(resource) {
                founded.stockOf(resource).total shouldBe 0
                founded.stockOf(resource).ratePerSecond shouldBe 0.0
                // Ninety seconds on and still nothing: the rate shape is carried, and it carries zero.
                founded.stockOf(resource).at(noon.plusSeconds(90)) shouldBe 0
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

    // ---- resources -------------------------------------------------------------------------------

    val standing = HouseDecider.fold(HouseDecider.decide(ravenscar, HouseDecider.initial))
    val glass = PledgeId(UUID.fromString("bb000000-0000-4000-8000-00000000d101"))
    val later = WorldTime(455205)

    fun granting(resource: Resource = Resource.WEALTH, amount: Long = 120) =
        GrantResource(house, resource, amount, day, noon)

    fun spending(resource: Resource = Resource.WEALTH, amount: Long = 50) =
        SpendResource(house, resource, amount, day, noon)

    fun pledging(amount: Long = 35, id: PledgeId = glass, until: WorldTime = later) =
        PledgeResource(house, id, Resource.REASON, amount, until, "the making of clearer glass", day, noon)

    /** The house after everything these commands did to it, in order. */
    fun after(vararg commands: HouseCommand): House.Founded =
        commands.fold(standing) { state, command ->
            HouseDecider.decide(command, state).fold(state, HouseDecider::evolve)
        }.shouldBeInstanceOf<House.Founded>()

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

    fun figure(n: Int) = CharacterId(UUID.fromString("cc000000-0000-4000-8000-%012d".format(n)))
    fun founded(): House = HouseDecider.fold(HouseDecider.decide(ravenscar, HouseDecider.initial))
    fun takeIn(house: House, n: Int): House =
        HouseDecider.decide(TakeKeyFigure(ravenscar.houseId, figure(n), day, noon), house).fold(house, HouseDecider::evolve)
    fun holding(count: Int): House = (1..count).fold(founded(), ::takeIn)

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

    /** Acting through: the house's own history decides whose key figure a character is, and nothing is written. */
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
