package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import java.util.UUID

class DialogueSpec : StringSpec({
    val house = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"))
    val agnes = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))
    val lady = Speaker(SpeakerId("agnes"), party = 0, name = "Agnes Hollin", portrait = "woman-03", character = agnes)
    val messenger = Speaker(SpeakerId("messenger"), party = 1, name = "A messenger", portrait = null, character = null)

    fun line(id: String, then: Then, by: Speaker = messenger, effects: List<Effect> = emptyList()) =
        Line(id = LineId(id), speaker = by.id, words = "The words of $id.", effects = effects, then = then)

    fun dialogue(
        vararg lines: Line,
        speakers: List<Speaker> = listOf(lady, messenger),
        needing: List<Requirement> = emptyList(),
    ) =
        Dialogue(
            id = DialogueId(UUID.fromString("dd000000-0000-4000-8000-00000000a001")),
            title = "A letter from the coast",
            scene = "harbour",
            speakers = speakers,
            lines = lines.toList(),
            requirements = needing,
        )

    fun refusal(make: () -> Unit): String = shouldThrow<HouseError.InvalidDialogue>(make).message.orEmpty()

    // The messenger speaks, the lady chooses, and one of the two paths pays.
    val arrives = line("arrives", Then.Say(LineId("asks")))
    val asks = line("asks", Then.DialogueChoice(listOf(LineId("accept"), LineId("refuse"))))
    val purse = Effect.Grant(Resource.WEALTH, 100)
    val accept = line("accept", Then.Say(LineId("thanks")), by = lady, effects = listOf(purse))
    val refuse = line("refuse", Then.End, by = lady)
    val thanks = line("thanks", Then.End)

    "a dialogue is made whole, opens on its first line, and every line it leads to is its own" {
        val letter = dialogue(arrives, asks, accept, refuse, thanks)

        letter.lines.first() shouldBe arrives
        letter.line(LineId("asks"))?.then shouldBe Then.DialogueChoice(listOf(LineId("accept"), LineId("refuse")))
        letter.line(LineId("nowhere")) shouldBe null
    }

    "one line that ends it is a whole dialogue, and a monologue has one party" {
        dialogue(line("only", Then.End), speakers = listOf(messenger)).lines.size shouldBe 1
    }

    "a dialogue has a title and a line to open on" {
        refusal { dialogue(arrives, asks, accept, refuse, thanks).copy(title = " ") } shouldContain "title"
        refusal { dialogue() } shouldContain "open on"
    }

    "an id is a word, and no two speakers or lines of one dialogue share one" {
        refusal { dialogue(line("two words", Then.End)) } shouldContain "\"two words\""
        refusal { dialogue(line("", Then.End)) } shouldContain "id is a word"
        refusal { dialogue(line("a".repeat(Dialogue.LONGEST_ID + 1), Then.End)) } shouldContain "id is a word"
        dialogue(line("a".repeat(Dialogue.LONGEST_ID), Then.End)).lines.size shouldBe 1

        refusal { dialogue(line("again", Then.Say(LineId("again"))), line("again", Then.End)) } shouldContain "share"
        refusal { dialogue(line("only", Then.End), speakers = listOf(messenger, messenger)) } shouldContain "share"
    }

    "every line is said by somebody speaking, says something, and leads only to lines the dialogue has" {
        refusal { dialogue(line("only", Then.End), speakers = listOf(lady)) } shouldContain "not speaking"
        refusal { dialogue(line("only", Then.End).copy(words = "  ")) } shouldContain "says nothing"
        refusal { dialogue(line("only", Then.End), speakers = listOf(messenger.copy(name = ""))) } shouldContain
            "no name"
        refusal { dialogue(line("arrives", Then.Say(LineId("gone")))) } shouldContain "gone"
        refusal { dialogue(asks, accept, thanks) } shouldContain "refuse"
    }

    "a dialogue choice offers two to four lines, and none of them twice" {
        val ends = listOf("a", "b", "c", "d", "e").map { line(it, Then.End, by = lady) }
        fun choosing(vararg options: String): Dialogue {
            val asking = line("asks", Then.DialogueChoice(options.map(::LineId)))
            return dialogue(asking, *ends.filter { it.id.value in options }.toTypedArray())
        }

        refusal { choosing("a") } shouldContain "of 1"
        refusal { choosing("a", "b", "c", "d", "e") } shouldContain "of 5"
        choosing("a", "b").lines.size shouldBe 3
        choosing("a", "b", "c", "d").lines.size shouldBe 5
        refusal { choosing("a", "a") } shouldContain "twice"
    }

    "a conversation that comes back to a line it has said is refused, so every path ends" {
        refusal { dialogue(line("again", Then.Say(LineId("again")))) } shouldContain "from itself"
        val there = line("there", Then.Say(LineId("back")))
        val back = line("back", Then.Say(LineId("there")))
        refusal { dialogue(there, back) } shouldContain "from itself"

        // Back to the question from one of its own options, which is the conversation that returns to a hub.
        val backToTheQuestion = line("refuse", Then.Say(LineId("asks")), by = lady)
        refusal { dialogue(arrives, asks, accept, backToTheQuestion, thanks) } shouldContain "from itself"
    }

    "two paths may meet again, because meeting is not a loop" {
        val thanksForEither = line("refuse", Then.Say(LineId("thanks")), by = lady)

        dialogue(arrives, asks, accept, thanksForEither, thanks).lines.size shouldBe 5
    }

    "a line nothing leads to is refused, because it would never be said" {
        refusal { dialogue(arrives, asks, accept, refuse, thanks, line("stray", Then.End)) } shouldContain "stray"
    }

    "a line cannot found a house, and what it grants is more than nothing" {
        val founding = Effect.FoundAt(
            Location(59.33, 18.07),
            HouseName("Ravenscar"),
            Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
        )

        refusal { dialogue(line("only", Then.End, effects = listOf(founding))) } shouldContain "founds a house"
        shouldThrow<HouseError.InvalidAmount> { Effect.Grant(Resource.WEALTH, 0) }
        shouldThrow<HouseError.InvalidAmount> { Effect.Grant(Resource.PIETY, -5) }
    }

    "every speaker who is a character is required alive, beside whatever it was written to need" {
        val bea = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f7195790"))

        dialogue(arrives, asks, accept, refuse, thanks).needs() shouldBe setOf(Requirement.Alive(agnes))
        val writtenToNeed = listOf(Requirement.Alive(bea), Requirement.Alive(agnes))
        dialogue(arrives, asks, accept, refuse, thanks, needing = writtenToNeed).needs() shouldBe
            setOf(Requirement.Alive(agnes), Requirement.Alive(bea))
        dialogue(line("only", Then.End), speakers = listOf(messenger)).needs() shouldBe emptySet()
    }

    "a dialogue's id is worked out from the house and the command that offered it, so a resend offers the same one" {
        val command = UUID.fromString("1c000007-0000-4000-8000-000000000020")
        val other = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5b"))

        DialogueId.offered(house, command) shouldBe DialogueId.offered(house, command)
        DialogueId.offered(house, command) shouldNotBe DialogueId.offered(other, command)
        DialogueId.offered(house, command) shouldNotBe DialogueId.offered(house, UUID.randomUUID())
    }

    "only an option may spend, so a house that cannot pay can always answer otherwise" {
        val toll = Effect.Spend(Resource.WEALTH, 30)
        val paying = line("accept", Then.Say(LineId("thanks")), by = lady, effects = listOf(toll))

        dialogue(arrives, asks, paying, refuse, thanks).lines.size shouldBe 5
        refusal { dialogue(line("toll", Then.End, effects = listOf(toll))) } shouldContain "only an option may"
        shouldThrow<HouseError.InvalidAmount> { Effect.Spend(Resource.WEALTH, 0) }
    }

    "every dialogue choice keeps an option that costs nothing, where a house that cannot pay can answer" {
        val toll = Effect.Spend(Resource.WEALTH, 30)
        val paying = line("accept", Then.Say(LineId("thanks")), by = lady, effects = listOf(toll))
        val payingToo = line("refuse", Then.End, by = lady, effects = listOf(toll))

        refusal { dialogue(arrives, asks, paying, payingToo, thanks) } shouldContain "every option spends"
    }
})
