package villages.application

import villages.domain.Dialogue
import villages.domain.DialogueId
import villages.domain.Effect
import villages.domain.Line
import villages.domain.LineId
import villages.domain.Resource
import villages.domain.Speaker
import villages.domain.SpeakerId
import villages.domain.Then

/**
 * The dialogues the debug panel can offer, written here as the founding choice's words are, because nothing in
 * the world offers a dialogue yet. The panel names one and sends none of its words: a client that could write a
 * dialogue could write itself a reward. See decision record 0067.
 */
object SampleDialogues {
    /** A messenger brings the house's first key figure a letter, and one of the two answers pays. */
    const val LETTER = "letter"

    /** What the letter pays a house that stands behind the quay. */
    const val DUES = 100L

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
        fun line(line: String, by: Speaker, words: String, then: Then, gives: List<Effect> = emptyList()) =
            Line(LineId(line), by.id, words, gives, then = then)

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
                    Then.DialogueChoice(listOf(LineId("accept"), LineId("refuse"))),
                ),
                line(
                    "accept",
                    you,
                    "Tell him the house will, and that it expects its share of the dues.",
                    Then.Say(LineId("paid")),
                ),
                line("refuse", you, "Tell him the house has quays enough of its own.", Then.Say(LineId("shrugs"))),
                line(
                    "paid",
                    messenger,
                    "He thought you might say so. The first of the dues came with me.",
                    Then.End,
                    gives = listOf(Effect.Grant(Resource.WEALTH, DUES)),
                ),
                line("shrugs", messenger, "He thought you might say that too. I will tell him.", Then.End),
            ),
        )
    }
}
