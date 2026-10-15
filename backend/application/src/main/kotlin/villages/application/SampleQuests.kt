package villages.application

import villages.domain.Dialogue
import villages.domain.DialogueId
import villages.domain.DialogueNode
import villages.domain.Edge
import villages.domain.Effect
import villages.domain.Line
import villages.domain.LineId
import villages.domain.NodeId
import villages.domain.Objective
import villages.domain.ObjectiveId
import villages.domain.ObjectiveNode
import villages.domain.Quest
import villages.domain.QuestId
import villages.domain.Resource
import villages.domain.RevealImpact
import villages.domain.RewardNode
import villages.domain.Speaker
import villages.domain.SpeakerId
import villages.domain.StructureType
import villages.domain.Then
import villages.domain.Where
import villages.domain.ofNode

/**
 * The quests the debug panel can offer, written here as the sample dialogue is, because nothing in the world offers
 * a quest yet. The panel names one and sends none of its words: a client that could write a quest could write itself
 * a reward. Every word and number is a placeholder. See decision record 0096.
 */
object SampleQuests {
    /**
     * *The abbot of the isle*: an abbot asks what the house holds dearest. Answered well, the road goes by a pledge of
     * piety; answered badly, by a castle held on an island and a delivery of wealth, the cheap road crossed out. Both
     * join at the consecration, a question mark shown ahead, and end at the blessing, shown from the start.
     */
    const val ABBOT = "abbot"

    /** What the gift to the mission asks the house to pledge, and for how many months. */
    const val GIFT = 30L
    const val GIFT_MONTHS = 6

    /** What the light on the water asks the house to deliver, beside the castle. */
    const val LIGHT = 60L

    /** What the blessing gives. */
    const val BLESSING_PIETY = 150L
    const val BLESSING_INFLUENCE = 40L

    /** Every sample there is, by the name the panel sends. */
    val names: Set<String> = setOf(ABBOT)

    /** The scene behind the quest and its dialogues, from `world/scenes/`. */
    private const val SCENE = "harbour"

    /**
     * The sample of this name, offered under [id]. A name that is not a sample is refused as a malformed request
     * rather than a refusal of the rules, because no rule was asked.
     */
    fun named(name: String, id: QuestId): Quest = when (name) {
        ABBOT -> abbotOfTheIsle(id)
        else -> throw IllegalArgumentException("there is no sample quest called \"$name\"")
    }

    private val abbot = Speaker(SpeakerId("abbot"), party = 1, name = "The abbot", portrait = null, character = null)
    private val steward = Speaker(SpeakerId("steward"), party = 0, name = "Your steward", portrait = null, character = null)

    private fun abbotOfTheIsle(id: QuestId): Quest {
        val gate = NodeId("gate")
        val gift = NodeId("gift")
        val light = NodeId("light")
        val consecration = NodeId("consecration")
        val blessing = NodeId("blessing")
        return Quest(
            id = id,
            title = "The abbot of the isle",
            scene = SCENE,
            nodes = listOf(
                DialogueNode(
                    gate,
                    "The abbot at the gate",
                    atTheGate(DialogueId.ofNode(id, gate)),
                    edges = listOf(Edge(gift, setOf(LineId("pleased"))), Edge(light, setOf(LineId("doubts")))),
                ),
                ObjectiveNode(
                    gift,
                    "A gift to the mission",
                    listOf(Objective.Pledge(ObjectiveId("piety"), Resource.PIETY, GIFT, GIFT_MONTHS)),
                    edges = listOf(Edge(consecration)),
                    hidden = true,
                ),
                ObjectiveNode(
                    light,
                    "A light on the water",
                    listOf(
                        Objective.Hold(ObjectiveId("castle"), StructureType("castle"), Where.Island),
                        Objective.Deliver(ObjectiveId("wealth"), Resource.WEALTH, LIGHT),
                    ),
                    edges = listOf(Edge(consecration)),
                    hidden = true,
                ),
                DialogueNode(
                    consecration,
                    "The consecration",
                    theConsecration(DialogueId.ofNode(id, consecration)),
                    edges = listOf(Edge(blessing)),
                    hidden = true,
                    shownAhead = true,
                ),
                RewardNode(
                    blessing,
                    "The abbot's blessing",
                    listOf(Effect.Grant(Resource.PIETY, BLESSING_PIETY), Effect.Grant(Resource.INFLUENCE, BLESSING_INFLUENCE)),
                    shownAhead = true,
                ),
            ),
        )
    }

    private fun atTheGate(id: DialogueId) = Dialogue(
        id = id,
        title = "The abbot at the gate",
        scene = SCENE,
        speakers = listOf(abbot, steward),
        lines = listOf(
            Line(
                LineId("arrives"),
                abbot.id,
                "An abbot waits at the gate, salt on his habit. On his island the light has gone out, he says.",
                then = Then.Say(LineId("asks")),
            ),
            Line(
                LineId("asks"),
                abbot.id,
                "He would raise a mission there, and asks first what your house holds dearest.",
                then = Then.DialogueChoice(listOf(LineId("faith"), LineId("coffers"))),
            ),
            Line(LineId("faith"), steward.id, "Tell him: its faith.", then = Then.Say(LineId("pleased")), revealImpact = RevealImpact.Hidden),
            Line(LineId("coffers"), steward.id, "Tell him: its coffers.", then = Then.Say(LineId("doubts")), revealImpact = RevealImpact.Hidden),
            Line(
                LineId("pleased"),
                abbot.id,
                "Then a gift of faith will do. Pledge what piety the house can spare to the mission.",
                then = Then.End,
            ),
            Line(
                LineId("doubts"),
                abbot.id,
                "Then coin alone will not light it. Hold a castle on the island, and send wealth to keep the fire.",
                then = Then.End,
            ),
        ),
    )

    private fun theConsecration(id: DialogueId) = Dialogue(
        id = id,
        title = "The consecration",
        scene = SCENE,
        speakers = listOf(abbot),
        lines = listOf(
            Line(LineId("stands"), abbot.id, "The mission stands, and the light burns again.", then = Then.Say(LineId("blesses"))),
            Line(LineId("blesses"), abbot.id, "Your house kept faith with me. Take my blessing.", then = Then.End),
        ),
    )
}
