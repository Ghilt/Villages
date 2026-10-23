package villages.domain

import java.util.UUID

/*
 * The quest the quest specs stand on: the shape of the sample, *The abbot of the isle*. The abbot asks what the
 * house holds dearest; answered well, the road goes by a pledge, answered badly by a castle on an island and a
 * delivery; both join at the consecration, a question mark shown ahead, and end at the blessing, shown ahead.
 */

internal object Abbot {
    val questId = QuestId(UUID.fromString("ee000000-0000-4000-8000-00000000a001"))

    private val abbot = Speaker(SpeakerId("abbot"), party = 1, name = "The abbot", portrait = null, character = null)
    private val steward = Speaker(SpeakerId("steward"), party = 0, name = "Your steward", portrait = null, character = null)

    private fun line(id: String, by: Speaker, then: Then) = Line(LineId(id), by.id, "The words of $id.", then = then)

    private fun dialogue(node: String, vararg lines: Line) = Dialogue(
        id = DialogueId.ofNode(questId, NodeId(node)),
        title = "The abbot",
        scene = "harbour",
        speakers = listOf(abbot, steward),
        lines = lines.toList(),
    )

    /** The two lines the gate's dialogue can end on, one for each road. */
    val pleased = LineId("pleased")
    val doubts = LineId("doubts")

    val atTheGate = dialogue(
        "gate",
        line("asks", abbot, Then.DialogueChoice(listOf(LineId("faith"), LineId("wealth")))),
        line("faith", steward, Then.Say(pleased)),
        line("wealth", steward, Then.Say(doubts)),
        line("pleased", abbot, Then.End),
        line("doubts", abbot, Then.End),
    )
    val blesses = dialogue("consecration", line("blesses", abbot, Then.End))

    val gate = NodeId("gate")
    val gift = NodeId("gift")
    val light = NodeId("light")
    val consecration = NodeId("consecration")
    val blessing = NodeId("blessing")

    val piety = ObjectiveId("piety")
    val castle = ObjectiveId("castle")
    val wealth = ObjectiveId("wealth")

    val gateNode = DialogueNode(
        gate,
        "The abbot at the gate",
        atTheGate,
        edges = listOf(Edge(gift, setOf(pleased)), Edge(light, setOf(doubts))),
    )
    val giftNode = ObjectiveNode(
        gift,
        "A gift to the mission",
        listOf(Objective.Pledge(piety, Resource.PIETY, 30, months = 6)),
        edges = listOf(Edge(consecration)),
        hidden = true,
    )
    val lightNode = ObjectiveNode(
        light,
        "A light on the water",
        listOf(
            Objective.Hold(castle, StructureType("castle"), Where.Island),
            Objective.Deliver(wealth, Resource.WEALTH, 60),
        ),
        edges = listOf(Edge(consecration)),
        hidden = true,
    )
    val consecrationNode = DialogueNode(
        consecration,
        "The consecration",
        blesses,
        edges = listOf(Edge(blessing)),
        hidden = true,
        shownAhead = true,
    )
    val blessingNode = RewardNode(
        blessing,
        "The abbot's blessing",
        listOf(Effect.Grant(Resource.PIETY, 150), Effect.Grant(Resource.INFLUENCE, 40)),
        shownAhead = true,
    )

    val quest = Quest(
        id = questId,
        title = "The abbot of the isle",
        scene = "harbour",
        nodes = listOf(gateNode, giftNode, lightNode, consecrationNode, blessingNode),
    )
}

/**
 * The debate in the square, as a quest: its first node puts a challenge to the house, won leading straight to the
 * blessing and lost to a penance first. What the challenge node's tests are told against. See decision record 0107,
 * amended.
 */
object Debate {
    val questId = QuestId(UUID.fromString("ee000000-0000-4000-8000-00000000a002"))

    val square = NodeId("square")
    val penance = NodeId("penance")
    val blessing = NodeId("blessing")

    val reason = villages.domain.challenge.ChallengeSlice(
        villages.domain.challenge.Aspect.REASON, power = 50.0, integrity = 50.0, summonCount = 3,
        effects = listOf("reason.counsel", "reason.doubt"),
    )
    val generosity = villages.domain.challenge.ChallengeSlice(
        villages.domain.challenge.Aspect.GENEROSITY, power = 50.0, integrity = 50.0, summonCount = 3,
        effects = listOf("generosity.alms", "generosity.tend"),
    )

    val terms = QuestChallenge("debate", Opponent("Brother Anselm", "#a8452a"), listOf(reason, generosity))

    val squareNode = ChallengeNode(
        square,
        "Brother Anselm's challenge",
        terms,
        edges = listOf(Edge(blessing, verdict = Verdict.WON), Edge(penance, verdict = Verdict.LOST)),
    )
    val penanceNode = ObjectiveNode(
        penance,
        "A penance",
        listOf(Objective.Deliver(ObjectiveId("wealth"), Resource.WEALTH, 40)),
        edges = listOf(Edge(blessing)),
    )
    val blessingNode = RewardNode(blessing, "The brother's blessing", listOf(Effect.Grant(Resource.PIETY, 50)), shownAhead = true)

    val quest = Quest(id = questId, title = "The debate in the square", scene = null, nodes = listOf(squareNode, penanceNode, blessingNode))
}
