package villages.application

import villages.domain.Edge
import villages.domain.Effect
import villages.domain.HouseId
import villages.domain.LineId
import villages.domain.NodeId
import villages.domain.Objective
import villages.domain.ObjectiveId
import villages.domain.Quest
import villages.domain.QuestId
import villages.domain.Resource
import villages.domain.RevealImpact
import villages.domain.StructureType
import villages.domain.Then
import villages.domain.Where

/*
 * The abbot of the isle as the application's tests offer it: `world/catalogues/quests/abbot.json` and the dialogues it
 * names as they were taken over on 2026-10-16, their own here so a change to the files never moves a test.
 */

/** What the gift to the mission asks the house to pledge, for how many months; the light's delivery; the blessing. */
const val GIFT = 30L
const val GIFT_MONTHS = 6
const val LIGHT = 60L

private val abbot = DialogueTemplate.SpeakerTemplate("abbot", 1, DialogueTemplate.Who.Named("The abbot", null))

/** The dialogues the abbot's quest names, by their names in `dialogues/`. */
val ABBOT_DIALOGUES: Map<String, DialogueTemplate> = mapOf(
    "abbot-at-the-gate" to DialogueTemplate(
        title = "The abbot at the gate",
        scene = "harbour",
        speakers = listOf(abbot, DialogueTemplate.SpeakerTemplate("steward", 0, DialogueTemplate.Who.Named("Your steward", null))),
        lines = listOf(
            DialogueTemplate.LineTemplate(
                "arrives", "abbot", "An abbot waits at the gate, salt on his habit. On his island the light has gone out, he says.",
                emptyList(), Then.Say(LineId("asks")), null, null,
            ),
            DialogueTemplate.LineTemplate(
                "asks", "abbot", "He would raise a mission there, and asks first what your house holds dearest.",
                emptyList(), Then.DialogueChoice(listOf(LineId("faith"), LineId("coffers"))), null, null,
            ),
            DialogueTemplate.LineTemplate("faith", "steward", "Tell him: its faith.", emptyList(), Then.Say(LineId("pleased")), RevealImpact.Hidden, null),
            DialogueTemplate.LineTemplate("coffers", "steward", "Tell him: its coffers.", emptyList(), Then.Say(LineId("doubts")), RevealImpact.Hidden, null),
            DialogueTemplate.LineTemplate(
                "pleased", "abbot", "Then a gift of faith will do. Pledge what piety the house can spare to the mission.",
                emptyList(), Then.End, null, null,
            ),
            DialogueTemplate.LineTemplate(
                "doubts", "abbot", "Then coin alone will not light it. Hold a castle on the island, and send wealth to keep the fire.",
                emptyList(), Then.End, null, null,
            ),
        ),
    ),
    "the-consecration" to DialogueTemplate(
        title = "The consecration",
        scene = "harbour",
        speakers = listOf(abbot),
        lines = listOf(
            DialogueTemplate.LineTemplate("stands", "abbot", "The mission stands, and the light burns again.", emptyList(), Then.Say(LineId("blesses")), null, null),
            DialogueTemplate.LineTemplate("blesses", "abbot", "Your house kept faith with me. Take my blessing.", emptyList(), Then.End, null, null),
        ),
    ),
)

/** *The abbot of the isle*, as `quests/abbot.json` was taken over on 2026-10-16. */
val ABBOT = QuestTemplate(
    title = "The abbot of the isle",
    scene = "harbour",
    shownFromTheStart = false,
    nodes = listOf(
        QuestTemplate.DialogueAt(
            "gate", "The abbot at the gate", "abbot-at-the-gate",
            listOf(Edge(NodeId("gift"), setOf(LineId("pleased"))), Edge(NodeId("light"), setOf(LineId("doubts")))),
            hidden = false, shownAhead = false,
        ),
        QuestTemplate.ObjectivesAt(
            "gift", "A gift to the mission", listOf(Objective.Pledge(ObjectiveId("piety"), Resource.PIETY, GIFT, GIFT_MONTHS)),
            listOf(Edge(NodeId("consecration"))), hidden = true, shownAhead = false,
        ),
        QuestTemplate.ObjectivesAt(
            "light", "A light on the water",
            listOf(
                Objective.Hold(ObjectiveId("castle"), StructureType("castle"), Where.Island),
                Objective.Deliver(ObjectiveId("wealth"), Resource.WEALTH, LIGHT),
            ),
            listOf(Edge(NodeId("consecration"))), hidden = true, shownAhead = false,
        ),
        QuestTemplate.DialogueAt(
            "consecration", "The consecration", "the-consecration", listOf(Edge(NodeId("blessing"))), hidden = true, shownAhead = true,
        ),
        QuestTemplate.RewardAt(
            "blessing", "The abbot's blessing",
            listOf(Effect.Grant(Resource.PIETY, 150), Effect.Grant(Resource.INFLUENCE, 40)), emptyList(), hidden = false, shownAhead = true,
        ),
    ),
)

/** The abbot's quest made, as the shelf makes it, under [id] for [house]. */
fun abbotOfTheIsle(id: QuestId, house: HouseId): Quest = ABBOT.offered(id, house, ABBOT_DIALOGUES)
