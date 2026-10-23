package villages.occurrent

import villages.domain.ChallengeId
import villages.domain.ChallengeNode
import villages.domain.CharacterId
import villages.domain.Choice
import villages.domain.ChoiceId
import villages.domain.Dialogue
import villages.domain.DialogueId
import villages.domain.DialogueNode
import villages.domain.Edge
import villages.domain.Effect
import villages.domain.Event
import villages.domain.HouseId
import villages.domain.Line
import villages.domain.LineId
import villages.domain.NodeId
import villages.domain.Objective
import villages.domain.Opponent
import villages.domain.ObjectiveId
import villages.domain.ObjectiveNode
import villages.domain.Option
import villages.domain.OptionId
import villages.domain.PlayerId
import villages.domain.PlayerCompletedQuest
import villages.domain.PlayerLostQuest
import villages.domain.PlayerLostQuestNode
import villages.domain.PlayerCompletedQuestNode
import villages.domain.PlayerGivenChoice
import villages.domain.PlayerMetQuestObjective
import villages.domain.PlayerOfferedQuest
import villages.domain.PlayerResolvedChallenge
import villages.domain.PledgeId
import villages.domain.Quest
import villages.domain.QuestChallenge
import villages.domain.QuestId
import villages.domain.Requirement
import villages.domain.Stat
import villages.domain.Resource
import villages.domain.RewardNode
import villages.domain.Speaker
import villages.domain.SpeakerId
import villages.domain.StructureType
import villages.domain.Then
import villages.domain.Verdict
import villages.domain.Where
import villages.domain.WorldTime
import villages.domain.challenge.Aspect
import villages.domain.challenge.ChallengeSetup
import villages.domain.challenge.ChallengeSlice
import villages.domain.challenge.Ending
import villages.domain.challenge.Fits
import villages.domain.challenge.Gain
import villages.domain.challenge.Happening
import villages.domain.challenge.Loss
import villages.domain.challenge.Outcome
import villages.domain.challenge.Progression
import villages.domain.challenge.Side
import villages.domain.challenge.StandIn
import villages.domain.ofNode
import java.time.Instant
import java.util.UUID

/**
 * A quest's events, as the store is held to write them: the quest samples of `EventSamples`, in a file of their
 * own so a mechanic's samples do not grow one long file. The offered quest holds every case of every sealed field
 * a quest has: each kind of node, each kind of objective, each place one can ask for, and a reward's grants.
 */
internal object QuestEventSamples {
    private val noon = Instant.parse("2026-09-04T12:00:00Z")
    private val house = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"))
    private val player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    private val day = WorldTime(454901)

    val questId = QuestId(UUID.fromString("ee000000-0000-4000-8000-00000000a001"))
    private val abbot = Speaker(SpeakerId("abbot"), party = 1, name = "The abbot", portrait = null, character = null)
    private val steward = Speaker(SpeakerId("steward"), party = 0, name = "Your steward", portrait = null, character = null)

    val theAbbot = PlayerOfferedQuest(
        houseId = house,
        player = player,
        quest = Quest(
            id = questId,
            title = "The abbot of the isle",
            scene = "harbour",
            nodes = listOf(
                DialogueNode(
                    id = NodeId("gate"),
                    title = "The abbot at the gate",
                    dialogue = Dialogue(
                        id = DialogueId.ofNode(questId, NodeId("gate")),
                        title = "The abbot at the gate",
                        scene = "harbour",
                        speakers = listOf(abbot, steward),
                        lines = listOf(
                            Line(
                                LineId("asks"),
                                abbot.id,
                                "What does your house hold dearest?",
                                then = Then.DialogueChoice(listOf(LineId("faith"), LineId("wealth"))),
                            ),
                            Line(LineId("faith"), steward.id, "Its faith, Father.", then = Then.End),
                            Line(LineId("wealth"), steward.id, "Its coffers, Father.", then = Then.End),
                        ),
                    ),
                    edges = listOf(
                        Edge(NodeId("gift"), setOf(LineId("faith"))),
                        Edge(NodeId("light"), setOf(LineId("wealth"))),
                    ),
                ),
                ObjectiveNode(
                    id = NodeId("gift"),
                    title = "A gift to the mission",
                    objectives = listOf(Objective.Pledge(ObjectiveId("piety"), Resource.PIETY, 30, months = 6)),
                    edges = listOf(Edge(NodeId("blessing"))),
                    hidden = true,
                ),
                ObjectiveNode(
                    id = NodeId("light"),
                    title = "A light on the water",
                    objectives = listOf(
                        Objective.Hold(ObjectiveId("castle"), StructureType("castle"), Where.Island),
                        Objective.Hold(ObjectiveId("mill"), StructureType("mill")),
                        Objective.Deliver(ObjectiveId("wealth"), Resource.WEALTH, 60),
                    ),
                    edges = listOf(Edge(NodeId("blessing"))),
                    hidden = true,
                ),
                RewardNode(
                    id = NodeId("blessing"),
                    title = "The abbot's blessing",
                    gives = listOf(Effect.Grant(Resource.PIETY, 150), Effect.Grant(Resource.INFLUENCE, 40)),
                    shownAhead = true,
                ),
            ),
        ),
        worldTime = day,
        recordedAt = noon,
    )

    val wealthDelivered = PlayerMetQuestObjective(house, player, questId, NodeId("light"), ObjectiveId("wealth"), day, noon)
    val pastTheLight = PlayerCompletedQuestNode(house, player, questId, NodeId("light"), NodeId("blessing"), day, noon)
    val blessed = PlayerCompletedQuest(house, player, questId, day, noon)
    val giftLost = PlayerLostQuestNode(house, player, questId, NodeId("gift"), day, noon)
    val abbotGone = PlayerLostQuest(house, player, questId, Requirement.Alive(CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))), day, noon)

    /** A choice whose option pledges, which no quest event writes: the pledge effect pinned in a case of its own. */
    val askedForAGift = PlayerGivenChoice(
        houseId = house,
        player = player,
        choice = Choice(
            id = ChoiceId(UUID.fromString("ee000000-0000-4000-8000-00000000c501")),
            prompt = "The abbot asks what the house will give.",
            options = listOf(
                Option(
                    OptionId(UUID.fromString("ee000000-0000-4000-8000-000000000011")),
                    "Pledge your faith",
                    "Thirty piety, for half a year.",
                    Effect.Pledge(PledgeId(UUID.fromString("ee000000-0000-4000-8000-00000000d501")), Resource.PIETY, 30, WorldTime(455083), "The abbot of the isle"),
                ),
                Option(
                    OptionId(UUID.fromString("ee000000-0000-4000-8000-000000000012")),
                    "Ask his blessing",
                    "A word in your favour.",
                    Effect.Grant(Resource.PIETY, 5),
                ),
            ),
        ),
        worldTime = day,
        recordedAt = noon,
    )

    /**
     * A quest whose first node puts a challenge to the house, forking on its verdict: the challenge node, its terms, and
     * both kinds of stand-in a slice can carry, which no other sample has. See decision record 0107, amended.
     */
    val theDebate = PlayerOfferedQuest(
        houseId = house,
        player = player,
        quest = Quest(
            id = QuestId(UUID.fromString("ee000000-0000-4000-8000-00000000a002")),
            title = "The debate in the square",
            scene = null,
            nodes = listOf(
                ChallengeNode(
                    id = NodeId("square"),
                    title = "Brother Anselm's challenge",
                    challenge = QuestChallenge(
                        kind = "debate",
                        against = Opponent("Brother Anselm", "#a8452a"),
                        slices = listOf(
                            ChallengeSlice(
                                Aspect.REASON, power = 50.0, integrity = 46.0, summonCount = 3,
                                effects = listOf("reason.counsel", "reason.doubt"),
                                slotted = mapOf(
                                    "reason.counsel" to StandIn.KeyFigure(
                                        "Master Oswin",
                                        mapOf(Stat.PIETY to 8, Stat.REASON to 16, Stat.KINDNESS to 9, Stat.PHYSICAL to 7),
                                    ),
                                ),
                            ),
                            ChallengeSlice(
                                Aspect.HOLY, power = 50.0, integrity = 50.0, summonCount = 3,
                                effects = listOf("holy.ordination", "holy.sanctuary"),
                                slotted = mapOf("holy.sanctuary" to StandIn.Building("the chapel", 1)),
                            ),
                        ),
                    ),
                    edges = listOf(
                        Edge(NodeId("blessing"), verdict = Verdict.WON),
                        Edge(NodeId("penance"), verdict = Verdict.LOST),
                    ),
                ),
                ObjectiveNode(
                    id = NodeId("penance"),
                    title = "A penance",
                    objectives = listOf(Objective.Deliver(ObjectiveId("wealth"), Resource.WEALTH, 40)),
                    edges = listOf(Edge(NodeId("blessing"))),
                ),
                RewardNode(
                    id = NodeId("blessing"),
                    title = "The brother's blessing",
                    gives = listOf(Effect.Grant(Resource.PIETY, 50)),
                ),
            ),
        ),
        worldTime = day,
        recordedAt = noon,
    )

    /**
     * The debate won: the scholar and the almoner brought against Brother Anselm's two slices, fought over a progression
     * of three happenings from its seed, a gain and a loss in what it came to. The quest moves on by the events after it.
     */
    val debateWon = PlayerResolvedChallenge(
        houseId = house,
        player = player,
        challengeId = ChallengeId(UUID.fromString("c4000000-0000-4000-8000-0000000000d1")),
        questId = theDebate.quest.id,
        nodeId = NodeId("square"),
        kind = "debate",
        against = Opponent("Brother Anselm", "#a8452a"),
        brought = listOf("scholar", "almoner"),
        setup = ChallengeSetup(
            a = listOf(
                ChallengeSlice(Aspect.REASON, 50.0, 50.0, 3, listOf("reason.refutation", "reason.foresight")),
                ChallengeSlice(Aspect.GENEROSITY, 50.0, 50.0, 3, listOf("generosity.alms", "generosity.tend")),
            ),
            b = (theDebate.quest.start() as ChallengeNode).challenge.slices,
            progression = Progression(30, listOf(Happening(Aspect.REASON), Happening(Aspect.HOLY, Aspect.GENEROSITY), Happening(Aspect.REASON))),
        ),
        seed = 4242L,
        catalogue = "3f1c2a",
        engine = 2,
        outcome = Outcome(
            tug = 41.5,
            ended = Ending.TIME_RAN_OUT,
            second = 30,
            wonBy = Side.A,
            gains = listOf(Gain(Side.B, Resource.PIETY, 5.0, "holy.sanctuary")),
            losses = listOf(Loss(Side.B, "the chapel", Fits.STRUCTURE, 10.0, "reason.refutation")),
        ),
        worldTime = day,
        recordedAt = noon,
    )

    val cases: Map<String, Event> = mapOf(
        "villages.player.givenChoice.v1.pledge" to askedForAGift,
        "villages.player.offeredQuest.v1.challenge" to theDebate,
    )

    val samples: Map<String, Event> = mapOf(
        "villages.player.completedQuest.v1" to blessed,
        "villages.player.completedQuestNode.v1" to pastTheLight,
        "villages.player.lostQuest.v1" to abbotGone,
        "villages.player.lostQuestNode.v1" to giftLost,
        "villages.player.metQuestObjective.v1" to wealthDelivered,
        "villages.player.offeredQuest.v1" to theAbbot,
        "villages.player.resolvedChallenge.v1" to debateWon,
    )
}
