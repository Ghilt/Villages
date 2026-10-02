package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.util.UUID

/** The house: a dialogue offered whole, stepped through, and lapsed when what it needs fails. The fixtures are HouseFixtures.kt. */
class HouseDialoguesSpec : StringSpec({

    "a house is offered a dialogue whole, for its own player, and keeps it open" {
        val events = HouseDecider.decide(offering(), standing)

        events.single() shouldBe PlayerOfferedDialogue(house, player, letter(), day, noon)
        val holding = events.fold(standing, HouseDecider::evolve).shouldBeInstanceOf<House.Founded>()
        holding.openDialogues shouldBe listOf(OpenDialogue(letter()))
        holding.offeredDialogues shouldBe setOf(letter().id)
    }

    "several dialogues can be open at once, in the order they were offered" {
        val second = letter(UUID.fromString("1c000007-0000-4000-8000-000000000021"))

        after(offering(), offering(second)).openDialogues.map { it.dialogue.id } shouldBe listOf(letter().id, second.id)
    }

    "the same dialogue offered twice is refused, which is what makes a resend harmless" {
        shouldThrow<HouseError.DialogueAlreadyOffered> { HouseDecider.decide(offering(), after(offering())) }
    }

    "a dialogue is offered only to a house that exists" {
        shouldThrow<HouseError.NoSuchHouse> { HouseDecider.decide(offering(), HouseDecider.initial) }
    }

    "taking an option records the step and then what the line gives, from one decision" {
        val events = HouseDecider.decide(stepping("accept"), talking)

        events shouldBe listOf(
            PlayerCompletedDialogueStep(house, player, quay.id, LineId("accept"), day, noon),
            HouseResourceGranted(house, Resource.WEALTH, 100, day, noon),
        )
        val stepped = events.fold(talking, HouseDecider::evolve).shouldBeInstanceOf<House.Founded>()
        stepped.stockOf(Resource.WEALTH).at(noon) shouldBe 100
        stepped.openDialogues.single().taken shouldBe listOf(LineId("accept"))
    }

    "the line that ends a dialogue records the step, what it gives and the end, in that order, and it is not open" {
        val events = HouseDecider.decide(stepping("refuse"), talking)

        events.map { it::class } shouldBe
            listOf(PlayerCompletedDialogueStep::class, HouseResourceGranted::class, PlayerCompletedDialogue::class)
        events.last() shouldBe PlayerCompletedDialogue(house, player, quay.id, day, noon)
        val over = events.fold(talking, HouseDecider::evolve).shouldBeInstanceOf<House.Founded>()
        over.openDialogues shouldBe emptyList()
        over.offeredDialogues shouldBe setOf(quay.id)
    }

    "a dialogue read to its end has paid each line on its path once" {
        val paid = after(offering(quay), stepping("accept"), stepping("thanks"))

        paid.stockOf(Resource.WEALTH).at(noon) shouldBe 100
        paid.stockOf(Resource.INFLUENCE).at(noon) shouldBe 0
        shouldThrow<HouseError.DialogueOver> { HouseDecider.decide(stepping("thanks"), paid) }
    }

    "a step already passed, one further on, the road not taken, or a line that is only read is not the next step" {
        val accepted = after(offering(quay), stepping("accept"))

        shouldThrow<HouseError.NotTheNextStep> { HouseDecider.decide(stepping("accept"), accepted) }
        shouldThrow<HouseError.NotTheNextStep> { HouseDecider.decide(stepping("refuse"), accepted) }
        for (never in listOf("thanks", "arrives", "asks", "nowhere")) {
            shouldThrow<HouseError.NotTheNextStep> { HouseDecider.decide(stepping(never), talking) }
        }
    }

    "a step through a dialogue never offered, or one that is over, is refused, and so is one in no house" {
        shouldThrow<HouseError.NoSuchDialogue> { HouseDecider.decide(stepping("accept", letter().id), talking) }
        shouldThrow<HouseError.DialogueOver> {
            HouseDecider.decide(stepping("accept"), after(offering(quay), stepping("refuse")))
        }
        shouldThrow<HouseError.NoSuchHouse> { HouseDecider.decide(stepping("accept"), HouseDecider.initial) }
    }

    "an option that spends is paid as the step is taken, or refused while the house cannot pay, the dialogue open" {
        val toll = Dialogue(
            id = DialogueId.offered(house, UUID.fromString("1c000007-0000-4000-8000-000000000032")),
            title = "A toll",
            scene = null,
            speakers = listOf(lady, messenger),
            lines = listOf(
                said("asks", Then.DialogueChoice(listOf(LineId("pay"), LineId("decline")))),
                said("pay", Then.End, by = lady, effects = listOf(Effect.Spend(Resource.WEALTH, 30))),
                said("decline", Then.End, by = lady),
            ),
        )

        val poor = after(offering(toll))
        shouldThrow<HouseError.NotEnoughFree> { HouseDecider.decide(stepping("pay", toll.id), poor) }
        poor.openDialogues.single().walk().allows(LineId("decline")) shouldBe true

        val rich = after(granting(amount = 50), offering(toll))
        val events = HouseDecider.decide(stepping("pay", toll.id), rich)
        events.map { it::class } shouldBe
            listOf(PlayerCompletedDialogueStep::class, HouseResourceSpent::class, PlayerCompletedDialogue::class)
        val paidFor = events.fold(rich, HouseDecider::evolve).shouldBeInstanceOf<House.Founded>()
        paidFor.stockOf(Resource.WEALTH).at(noon) shouldBe 20
    }

    "a requirement failing lapses every open dialogue that needed it, from one decision, and they are not open" {
        val talking = after(offering(herFirst), offering(theMessengers), offering(herSecond))

        val events = HouseDecider.decide(herDeath, talking)

        events shouldBe listOf(
            PlayerLostDialogue(house, player, herFirst.id, Requirement.Alive(agnes), day, noon),
            PlayerLostDialogue(house, player, herSecond.id, Requirement.Alive(agnes), day, noon),
        )
        val lost = events.fold(talking, HouseDecider::evolve).shouldBeInstanceOf<House.Founded>()
        lost.openDialogues.map { it.dialogue.id } shouldBe listOf(theMessengers.id)
        shouldThrow<HouseError.DialogueOver> { HouseDecider.decide(stepping("only", herFirst.id), lost) }
    }

    "a failure that touches no open dialogue writes nothing, so a replay of it does no harm" {
        val lost = after(offering(herFirst), herDeath)

        HouseDecider.decide(herDeath, lost) shouldBe emptyList()
        HouseDecider.decide(herDeath, after(offering(theMessengers))) shouldBe emptyList()
        shouldThrow<HouseError.NoSuchHouse> { HouseDecider.decide(herDeath, HouseDecider.initial) }
    }

    "a dialogue finished before its speaker died is finished, and stays so" {
        val finished = after(offering(herFirst), stepping("only", herFirst.id))

        HouseDecider.decide(herDeath, finished) shouldBe emptyList()
    }

    "a conversation of forty lines writes a handful of events, not one a line" {
        val opening = (1..19).map { said("l$it", Then.Say(LineId("l${it + 1}"))) } +
            said("l20", Then.DialogueChoice(listOf(LineId("a1"), LineId("b1"))))
        val branches = (1..10).flatMap { n ->
            fun next(branch: String) = if (n == 10) Then.End else Then.Say(LineId("$branch${n + 1}"))
            listOf(said("a$n", next("a"), effects = if (n == 5) listOf(coin) else emptyList()), said("b$n", next("b")))
        }
        val evening = Dialogue(
            id = DialogueId.offered(house, UUID.fromString("1c000007-0000-4000-8000-000000000031")),
            title = "A long evening",
            scene = null,
            speakers = listOf(lady, messenger),
            lines = opening + branches,
        )

        var state: House = after(offering(evening))
        val written = mutableListOf<HouseEvent>()
        for (step in listOf("a1", "a5", "a10")) {
            val events = HouseDecider.decide(CompleteDialogueStep(house, evening.id, LineId(step), day, noon), state)
            written += events
            state = events.fold(state, HouseDecider::evolve)
        }

        // Thirty of the forty lines read: the offer, three steps, what one of them gives, and the end.
        evening.lines.size shouldBe 40
        1 + written.size shouldBe 6
        state.shouldBeInstanceOf<House.Founded>().openDialogues shouldBe emptyList()
    }
})
