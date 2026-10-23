package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.domain.challenge.Aspect
import villages.domain.challenge.ChallengeResult
import villages.domain.challenge.ChallengeSetup
import villages.domain.challenge.ChallengeSlice
import villages.domain.challenge.Ending
import villages.domain.challenge.Happening
import villages.domain.challenge.Outcome
import villages.domain.challenge.Progression
import villages.domain.challenge.Side
import java.util.UUID

/**
 * The house: a challenge a quest's node puts, accepted with starting slices, fought, recorded and the quest moved on in
 * one decision, so a challenge never waits to be started and is never fought without its quest taking the outcome.
 * The fixtures are QuestFixtures.kt. See decision record 0107, amended.
 */
class HouseChallengesSpec : StringSpec({
    val debate = Debate.quest
    val scholar = ChallengeSlice(Aspect.REASON, 50.0, 50.0, 3, listOf("reason.refutation", "reason.foresight"))
    val almoner = ChallengeSlice(Aspect.GENEROSITY, 50.0, 50.0, 3, listOf("generosity.alms", "generosity.tend"))
    val starting = mapOf("scholar" to scholar, "almoner" to almoner)
    val challenge = ChallengeId(UUID.fromString("c4000000-0000-4000-8000-0000000000d1"))

    fun offering(quest: Quest = debate) = OfferQuest(house, quest, day, noon)

    /** It fought out with what was brought against the node's opponent, won by [wonBy], a draw when none. */
    fun fought(wonBy: Side?, ours: List<ChallengeSlice> = listOf(scholar, almoner), theirs: List<ChallengeSlice> = Debate.terms.slices) =
        FoughtChallenge(
            "debate",
            ChallengeSetup(ours, theirs, Progression(30, listOf(Happening(Aspect.REASON)))),
            ChallengeResult(
                seed = 7,
                moments = emptyList(),
                outcome = Outcome(
                    tug = when (wonBy) { Side.A -> 40.0; Side.B -> -40.0; null -> 0.0 },
                    ended = Ending.TIME_RAN_OUT,
                    second = 30,
                    wonBy = wonBy,
                    gains = emptyList(),
                    losses = emptyList(),
                ),
            ),
            catalogue = "fp",
            engine = 2,
        )

    fun accepting(fought: FoughtChallenge?, brought: List<String> = listOf("scholar", "almoner"), node: NodeId = Debate.square) =
        AcceptChallenge(house, debate.id, node, brought, starting, challenge, fought, day, noon)

    "accepted and won, it is recorded and the quest takes the won road in one decision, the lost road cut off" {
        val won = fought(Side.A)

        HouseDecider.decide(accepting(won), after(offering())) shouldBe listOf(
            PlayerResolvedChallenge(
                house, player, challenge, debate.id, Debate.square, "debate", Debate.terms.against, listOf("scholar", "almoner"),
                won.setup, won.result.seed, "fp", 2, won.result.outcome, day, noon,
            ),
            PlayerCompletedQuestNode(house, player, debate.id, Debate.square, Debate.blessing, day, noon),
            PlayerLostQuestNode(house, player, debate.id, Debate.penance, day, noon),
        )
        after(offering(), accepting(won)).openQuests.single().walk().at shouldBe Debate.blessing
    }

    "lost, it takes the lost road to the node that costs; a draw is lost" {
        for (outcome in listOf(Side.B, null)) {
            val events = HouseDecider.decide(accepting(fought(outcome)), after(offering()))

            events.first().shouldBeInstanceOf<PlayerResolvedChallenge>()
            events.drop(1) shouldBe listOf(PlayerCompletedQuestNode(house, player, debate.id, Debate.square, Debate.penance, day, noon))
        }
    }

    "a challenge node is fought once: accepted again, the quest no longer stands there" {
        shouldThrow<HouseError.NotTheCurrentNode> { HouseDecider.decide(accepting(fought(Side.A)), after(offering(), accepting(fought(Side.A)))) }
    }

    "a challenge is accepted only where the quest stands, and only at a node that puts one" {
        shouldThrow<HouseError.NotTheCurrentNode> {
            HouseDecider.decide(accepting(fought(Side.A), node = Debate.penance), after(offering()))
        }
        val abbot = Abbot.quest
        shouldThrow<HouseError.NotAChallenge> {
            HouseDecider.decide(AcceptChallenge(house, abbot.id, Abbot.gate, listOf("scholar"), starting, challenge, null, day, noon), after(OfferQuest(house, abbot, day, noon)))
        }
        shouldThrow<HouseError.NoSuchQuest> { HouseDecider.decide(accepting(fought(Side.A)), standing) }
    }

    "it brings one to three of the starting slices, none twice, and nothing the house does not hold" {
        val at = after(offering())
        shouldThrow<HouseError.InvalidSlices> { HouseDecider.decide(accepting(null, brought = emptyList()), at) }
        shouldThrow<HouseError.InvalidSlices> { HouseDecider.decide(accepting(null, brought = List(4) { "scholar" }), at) }
        shouldThrow<HouseError.InvalidSlices> { HouseDecider.decide(accepting(null, brought = listOf("scholar", "scholar")), at) }
        shouldThrow<HouseError.NotAStartingSlice> { HouseDecider.decide(accepting(null, brought = listOf("scholar", "sophist")), at) }
    }

    "one that could not be fought is refused, and one fought on other terms than the node's is a fault, not a refusal" {
        val at = after(offering())
        shouldThrow<HouseError.InvalidSlices> { HouseDecider.decide(accepting(null), at) }
        shouldThrow<IllegalArgumentException> { HouseDecider.decide(accepting(fought(Side.A, theirs = listOf(scholar))), at) }
        shouldThrow<IllegalArgumentException> { HouseDecider.decide(accepting(fought(Side.A, ours = listOf(almoner, scholar))), at) }
    }

    "its id is worked out from the house and the command, so the same command names one challenge" {
        val command = UUID.fromString("ee000000-0000-4000-8000-000000000071")
        ChallengeId.accepted(house, command) shouldBe ChallengeId.accepted(house, command)
        (ChallengeId.accepted(house, command) == ChallengeId.accepted(house, UUID.randomUUID())) shouldBe false
    }
})
