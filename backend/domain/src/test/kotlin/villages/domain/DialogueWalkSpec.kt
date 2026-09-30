package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import java.util.UUID

class DialogueWalkSpec : StringSpec({
    val lady = Speaker(SpeakerId("agnes"), party = 0, name = "Agnes Hollin", portrait = "woman-03", character = null)
    val messenger = Speaker(SpeakerId("messenger"), party = 1, name = "A messenger", portrait = null, character = null)
    val purse = Effect.Grant(Resource.WEALTH, 100)

    fun line(
        id: String,
        then: Then,
        by: Speaker = messenger,
        effects: List<Effect> = emptyList(),
        recorded: Boolean = false,
    ) = Line(LineId(id), by.id, "The words of $id.", effects, recorded, then)

    fun dialogue(vararg lines: Line) = Dialogue(
        id = DialogueId(UUID.fromString("dd000000-0000-4000-8000-00000000a001")),
        title = "A letter from the coast",
        scene = null,
        speakers = listOf(lady, messenger),
        lines = lines.toList(),
    )

    fun ids(vararg ids: String): List<LineId> = ids.map(::LineId)

    // The messenger speaks, the lady chooses, and one of the two paths pays before it ends.
    val arrives = line("arrives", Then.Say(LineId("asks")))
    val asks = line("asks", Then.DialogueChoice(ids("accept", "refuse")))
    val accept = line("accept", Then.Say(LineId("thanks")), by = lady, effects = listOf(purse))
    val refuse = line("refuse", Then.End, by = lady)
    val thanks = line("thanks", Then.End)
    val letter = dialogue(arrives, asks, accept, refuse, thanks)

    "a dialogue nobody has stepped through opens on the stretch up to its dialogue choice, with the options pending" {
        letter.walk(emptyList()) shouldBe
            Walk(said = emptyList(), next = listOf(arrives, asks), options = listOf(accept, refuse))
    }

    "taking an option says the stretch before it and the option, and reads on to the next step" {
        letter.walk(ids("accept")) shouldBe
            Walk(said = listOf(arrives, asks, accept), next = listOf(thanks), options = emptyList())
    }

    "reaching the end says everything along the path taken, and nothing along the other" {
        val paid = letter.walk(ids("accept", "thanks"))
        paid.said shouldBe listOf(arrives, asks, accept, thanks)
        paid.over.shouldBeTrue()

        val refused = letter.walk(ids("refuse"))
        refused.said shouldBe listOf(arrives, asks, refuse)
        refused.over.shouldBeTrue()
    }

    "only a pending option, or the step a stretch ends in, can be taken next" {
        val opening = letter.walk(emptyList())
        opening.allows(LineId("accept")).shouldBeTrue()
        opening.allows(LineId("refuse")).shouldBeTrue()
        for (never in ids("arrives", "asks", "thanks", "nowhere")) {
            opening.allows(never).shouldBeFalse()
        }

        val accepted = letter.walk(ids("accept"))
        accepted.allows(LineId("thanks")).shouldBeTrue()
        accepted.allows(LineId("accept")).shouldBeFalse()
        accepted.allows(LineId("refuse")).shouldBeFalse()

        letter.walk(ids("accept", "thanks")).allows(LineId("thanks")).shouldBeFalse()
    }

    "a line is a step when it has an effect, ends the dialogue, is marked, or is an option, and the rest are only read" {
        letter.lines.filter(letter::isStep) shouldBe listOf(accept, refuse, thanks)

        val marked = line("marked", Then.Say(LineId("end")), recorded = true)
        val talk = dialogue(marked, line("end", Then.End))
        talk.isStep(marked).shouldBeTrue()
    }

    "a marked line ends a stretch, so a dialogue picked up again goes on from there" {
        val first = line("first", Then.Say(LineId("second")), recorded = true)
        val second = line("second", Then.Say(LineId("third")))
        val third = line("third", Then.End)
        val talk = dialogue(first, second, third)

        talk.walk(emptyList()).next shouldBe listOf(first)
        talk.walk(ids("first")) shouldBe Walk(said = listOf(first), next = listOf(second, third), options = emptyList())
    }

    "a step followed by a dialogue choice leaves nothing to read but the options" {
        val gift = line("gift", Then.DialogueChoice(ids("yes", "no")), effects = listOf(purse))
        val yes = line("yes", Then.End, by = lady)
        val no = line("no", Then.End, by = lady)
        val talk = dialogue(gift, yes, no)

        talk.walk(emptyList()) shouldBe Walk(said = emptyList(), next = listOf(gift), options = emptyList())
        talk.walk(ids("gift")) shouldBe Walk(said = listOf(gift), next = emptyList(), options = listOf(yes, no))
    }

    "paths that meet again pay the line where they meet once, whichever way they came" {
        val kindly = line("kindly", Then.Say(LineId("paid")), by = lady)
        val coldly = line("coldly", Then.Say(LineId("paid")), by = lady)
        val paid = line("paid", Then.Say(LineId("gone")), effects = listOf(purse))
        val gone = line("gone", Then.End)
        val talk = dialogue(line("asks", Then.DialogueChoice(ids("kindly", "coldly"))), kindly, coldly, paid, gone)

        for (way in listOf("kindly", "coldly")) {
            val walked = talk.walk(ids(way, "paid", "gone"))
            walked.said.count { it == paid } shouldBe 1
            walked.over.shouldBeTrue()
            talk.walk(ids(way, "paid")).allows(LineId("paid")).shouldBeFalse()
        }
    }

    "recorded steps that follow no route through the dialogue are refused, because only a fault could write them" {
        shouldThrow<IllegalArgumentException> { letter.walk(ids("thanks")) }
        shouldThrow<IllegalArgumentException> { letter.walk(ids("accept", "refuse")) }
        shouldThrow<IllegalArgumentException> { letter.walk(ids("refuse", "thanks")) }
        shouldThrow<IllegalArgumentException> { letter.walk(ids("asks")) }
    }
})
