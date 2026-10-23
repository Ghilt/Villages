package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.util.UUID

/**
 * A roll is paid for and recorded with its omens, and its hand is given from the same decision: decision record
 * 0083. The luck is the application's; these are the rules `decide` keeps over what the luck dealt.
 */
class HouseRollsSpec : StringSpec({
    val river = Omen(OmenKey("map.river"), OmenKind.MAP, "River")
    val pious = Omen(OmenKey("house.pious"), OmenKind.HOUSE, "Pious", 104)

    fun dealt(n: Int, rarity: Rarity = Rarity.COMMON, omens: List<OmenKey> = emptyList()) = Option(
        OptionId(UUID.fromString("dd000000-0000-4000-8000-%012d".format(n))),
        "Collect the mill's dues",
        "The miller pays what he owes.",
        Effect.Grant(Resource.WEALTH, 15),
        rarity,
        omens,
    )

    fun hand(vararg options: Option) =
        Choice(ChoiceId(UUID.fromString("dd000000-0000-4000-8000-0000000c0001")), "What will the house do?", options.toList())

    fun rolling(
        choice: Choice = hand(dealt(1), dealt(2, omens = listOf(river.key)), dealt(3)),
        rarity: Rarity = Rarity.COMMON,
        price: Long = 10,
    ) = Roll(
        houseId = house,
        player = player,
        rollId = RollId(UUID.fromString("dd000000-0000-4000-8000-0000000a0001")),
        omens = listOf(pious, river),
        rarity = rarity,
        landing = Location(52.2, 21.0),
        circleKm = 25.0,
        price = Effect.Spend(Resource.WEALTH, price),
        hand = choice,
        worldTime = day,
        recordedAt = noon,
    )

    "a roll records where its die landed and how wide a circle round it the map was read in" {
        val rolled = HouseDecider.decide(rolling(), founded()).filterIsInstance<PlayerRolled>().single()

        rolled.landing shouldBe Location(52.2, 21.0)
        rolled.circleKm shouldBe 25.0
    }

    "a roll records itself, then its price, then its hand, from one decision" {
        val events = HouseDecider.decide(rolling(), founded())

        events.map { it::class } shouldBe listOf(PlayerRolled::class, HouseResourceSpent::class, PlayerGivenChoice::class)
        val rolled = events[0].shouldBeInstanceOf<PlayerRolled>()
        rolled.omens shouldBe listOf(pious, river)
        rolled.rarity shouldBe Rarity.COMMON
        events[1] shouldBe HouseResourceSpent(house, Resource.WEALTH, 10, day, noon)
        events[2].shouldBeInstanceOf<PlayerGivenChoice>().choice shouldBe rolling().hand
    }

    "a house that rolled has paid, and has the hand pending" {
        val before = founded()
        val after = HouseDecider.decide(rolling(), before).fold(before, HouseDecider::evolve)

        val house = after.shouldBeInstanceOf<House.Founded>()
        house.stockOf(Resource.WEALTH).at(noon) shouldBe FOUNDING_WEALTH - 10
        house.pending shouldBe rolling().hand
    }

    "nothing rolls before there is a house" {
        shouldThrow<HouseError.NoSuchHouse> { HouseDecider.decide(rolling(), HouseDecider.initial) }
    }

    "a house with a hand to answer cannot roll again" {
        val before = founded()
        val rolledOnce = HouseDecider.decide(rolling(), before).fold(before, HouseDecider::evolve)

        shouldThrow<HouseError.ChoicePending> { HouseDecider.decide(rolling(), rolledOnce) }
    }

    "a house that cannot pay the price does not roll, and nothing is written" {
        shouldThrow<HouseError.NotEnoughFree> { HouseDecider.decide(rolling(price = FOUNDING_WEALTH + 1), founded()) }
    }

    "a hand is all of the rarity rolled" {
        val mixed = hand(dealt(1), dealt(2, Rarity.LEGENDARY), dealt(3))

        shouldThrow<HouseError.InvalidChoice> { HouseDecider.decide(rolling(mixed), founded()) }
    }

    "an option names only omens the roll read" {
        val unread = hand(dealt(1), dealt(2, omens = listOf(OmenKey("map.whale"))), dealt(3))

        shouldThrow<HouseError.InvalidChoice> { HouseDecider.decide(rolling(unread), founded()) }
    }

    "an option that begins a conversation offers the dialogue from the same decision, and only once" {
        val servant = Speaker(SpeakerId("servant"), 1, "A servant", null, null)
        val gossip = Dialogue(
            id = DialogueId(UUID.fromString("dd000000-0000-4000-8000-00000000a002")),
            title = "Word of House Varga",
            scene = null,
            speakers = listOf(servant),
            lines = listOf(Line(LineId("says"), servant.id, "They say Varga is broke.", then = Then.End)),
        )
        val talking = dealt(1).copy(effect = Effect.Converse(gossip))
        val before = founded()
        val rolled = HouseDecider.decide(rolling(hand(talking, dealt(2), dealt(3))), before).fold(before, HouseDecider::evolve)
        val taking = TakeAction(house, player, rolling().hand.id, talking.id, day, noon)

        val events = HouseDecider.decide(taking, rolled)

        events.map { it::class } shouldBe listOf(PlayerTookAction::class, PlayerOfferedDialogue::class)
        val after = events.fold(rolled, HouseDecider::evolve).shouldBeInstanceOf<House.Founded>()
        after.dialogues.open.single().dialogue shouldBe gossip

        val again = HouseDecider.decide(rolling(hand(talking, dealt(2), dealt(3))), after).fold(after, HouseDecider::evolve)
        shouldThrow<HouseError.DialogueAlreadyOffered> { HouseDecider.decide(taking, again) }
    }

    "taking an option of a rolled hand answers it as any choice is answered" {
        val before = founded()
        val rolled = HouseDecider.decide(rolling(), before).fold(before, HouseDecider::evolve)
        val taking = TakeAction(house, player, rolling().hand.id, rolling().hand.options[1].id, day, noon)

        val events = HouseDecider.decide(taking, rolled)

        events[1] shouldBe HouseResourceGranted(house, Resource.WEALTH, 15, day, noon)
        val after = events.fold(rolled, HouseDecider::evolve).shouldBeInstanceOf<House.Founded>()
        after.pending shouldBe null
        after.stockOf(Resource.WEALTH).at(noon) shouldBe FOUNDING_WEALTH - 10 + 15
    }
})
