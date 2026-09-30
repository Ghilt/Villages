package villages.application

import villages.domain.Dialogue
import villages.domain.DialogueId
import villages.domain.Effect
import villages.domain.Impact
import villages.domain.Line
import villages.domain.LineId
import villages.domain.Resource
import villages.domain.RevealImpact
import villages.domain.Speaker
import villages.domain.SpeakerId
import villages.domain.Then

/**
 * The dialogues the debug panel can offer, written here as the founding choice's words are, because nothing in
 * the world offers a dialogue yet. The panel names one and sends none of its words: a client that could write a
 * dialogue could write itself a reward. See decision record 0067.
 */
object SampleDialogues {
    /**
     * A messenger brings the house's first key figure a letter, and it can be answered three ways: one that costs
     * the house and pays it back more, one that pays in another coin, and one that does nothing at all.
     */
    const val LETTER = "letter"

    /** What standing behind the quay costs the house: forty in wealth, for the masons. */
    const val MASONS = 40L

    /** What the harbour-master pays a house that stood behind the quay. */
    const val DUES = 100L

    /** What asking him earns instead: his good word at court. */
    const val GOOD_WORD = 5L

    /** Every sample there is, by the name the panel sends. */
    val names: Set<String> = setOf(LETTER)

    /**
     * The sample of this name, offered under [id] and spoken by [figure] and a messenger. A name that is not a
     * sample is refused as a malformed request rather than a refusal of the rules, because no rule was asked.
     */
    fun named(name: String, id: DialogueId, figure: CharacterRow): Dialogue = when (name) {
        LETTER -> letterFromTheCoast(id, figure)
        else -> throw IllegalArgumentException("there is no sample dialogue called \"$name\"")
    }

    private fun letterFromTheCoast(id: DialogueId, figure: CharacterRow): Dialogue {
        val you = Speaker(
            id = SpeakerId("figure"),
            party = 0,
            name = "${figure.name.given} ${figure.name.family}",
            portrait = figure.portrait,
            character = figure.id,
        )
        val messenger =
            Speaker(SpeakerId("messenger"), party = 1, name = "A messenger", portrait = null, character = null)
        fun line(
            line: String,
            by: Speaker,
            words: String,
            then: Then,
            effects: List<Effect> = emptyList(),
            revealImpact: RevealImpact? = null,
        ) =
            Line(LineId(line), by.id, words, effects, then = then, revealImpact = revealImpact)

        return Dialogue(
            id = id,
            title = "A letter from the coast",
            scene = "harbour",
            speakers = listOf(you, messenger),
            lines = listOf(
                line(
                    "arrives",
                    messenger,
                    "${figure.name.given}, a rider has come in from the coast " +
                        "with a letter under the harbour-master's seal.",
                    Then.Say(LineId("reads")),
                ),
                line(
                    "reads",
                    messenger,
                    "The harbour-master is building a new quay, and asks whether the house will stand behind it.",
                    Then.DialogueChoice(listOf(LineId("accept"), LineId("ask"), LineId("refuse"))),
                ),
                line(
                    "accept",
                    you,
                    "Tell him the house will, and send forty for the masons.",
                    Then.Say(LineId("paid")),
                    effects = listOf(Effect.Spend(Resource.WEALTH, MASONS)),
                    // Shown whole: what it costs now and what it will be paid, so the house can weigh the two.
                    revealImpact = RevealImpact.Shown(
                        listOf(Impact(Resource.WEALTH, -MASONS), Impact(Resource.WEALTH, DUES)),
                    ),
                ),
                line(
                    "paid",
                    messenger,
                    "He thought you might say so. The first of the dues came with me.",
                    Then.End,
                    effects = listOf(Effect.Grant(Resource.WEALTH, DUES)),
                ),
                // Hidden: something will come of asking, and nobody says what.
                line(
                    "ask",
                    you,
                    "Ask him what the house would have for it.",
                    Then.Say(LineId("answer")),
                    revealImpact = RevealImpact.Hidden,
                ),
                line(
                    "answer",
                    messenger,
                    "His good word at court, he says, and he gives it now, whatever you decide.",
                    Then.End,
                    effects = listOf(Effect.Grant(Resource.INFLUENCE, GOOD_WORD)),
                ),
                line("refuse", you, "Tell him the house has quays enough of its own.", Then.Say(LineId("shrugs"))),
                line("shrugs", messenger, "He thought you might say that too. I will tell him.", Then.End),
            ),
        )
    }
}
