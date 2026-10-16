package villages.application

import villages.domain.Effect
import villages.domain.Impact
import villages.domain.LineId
import villages.domain.Resource
import villages.domain.RevealImpact
import villages.domain.Then

/**
 * The letter from the coast as the tests offer it: `world/catalogues/dialogues/letter.json` as it was taken over on
 * 2026-10-16, its own here so a change to the file never moves a test.
 */
val TEST_LETTER = DialogueTemplate(
    title = "A letter from the coast",
    scene = "harbour",
    speakers = listOf(
        DialogueTemplate.SpeakerTemplate("figure", 0, DialogueTemplate.Who.KeyFigure),
        DialogueTemplate.SpeakerTemplate("messenger", 1, DialogueTemplate.Who.Named("A messenger", null)),
    ),
    lines = listOf(
        DialogueTemplate.LineTemplate(
            "arrives", "messenger", "{given}, a rider has come in from the coast with a letter under the harbour-master's seal.",
            emptyList(), Then.Say(LineId("reads")), null, DialogueTemplate.ShowsWhat.SEAT,
        ),
        DialogueTemplate.LineTemplate(
            "reads", "messenger", "The harbour-master is building a new quay, and asks whether the house will stand behind it.",
            emptyList(), Then.DialogueChoice(listOf(LineId("accept"), LineId("ask"), LineId("refuse"))), null, null,
        ),
        DialogueTemplate.LineTemplate(
            "accept", "figure", "Tell him the house will, and send forty for the masons.",
            listOf(Effect.Spend(Resource.WEALTH, 40)), Then.Say(LineId("paid")),
            RevealImpact.Shown(listOf(Impact(Resource.WEALTH, -40), Impact(Resource.WEALTH, 100))), null,
        ),
        DialogueTemplate.LineTemplate(
            "paid", "messenger", "He thought you might say so. The first of the dues came with me.",
            listOf(Effect.Grant(Resource.WEALTH, 100)), Then.End, null, DialogueTemplate.ShowsWhat.HOUSE,
        ),
        DialogueTemplate.LineTemplate(
            "ask", "figure", "Ask him what the house would have for it.",
            emptyList(), Then.Say(LineId("answer")), RevealImpact.Hidden, null,
        ),
        DialogueTemplate.LineTemplate(
            "answer", "messenger", "His good word at court, he says, and he gives it now, whatever you decide.",
            listOf(Effect.Grant(Resource.INFLUENCE, 5)), Then.End, null, DialogueTemplate.ShowsWhat.KEY_FIGURE,
        ),
        DialogueTemplate.LineTemplate(
            "refuse", "figure", "Tell him the house has quays enough of its own.", emptyList(), Then.Say(LineId("shrugs")), null, null,
        ),
        DialogueTemplate.LineTemplate(
            "shrugs", "messenger", "He thought you might say that too. I will tell him.", emptyList(), Then.End, null, null,
        ),
    ),
)
