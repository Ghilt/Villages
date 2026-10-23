package villages.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.domain.Banner
import villages.domain.ChallengeId
import villages.domain.ChallengeNode
import villages.domain.Charge
import villages.domain.Division
import villages.domain.Edge
import villages.domain.Effect
import villages.domain.FoundHouse
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseError
import villages.domain.HouseEvent
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.NodeId
import villages.domain.OfferQuest
import villages.domain.Opponent
import villages.domain.PlayerCompletedQuestNode
import villages.domain.PlayerId
import villages.domain.PlayerOfferedQuest
import villages.domain.PlayerResolvedChallenge
import villages.domain.Quest
import villages.domain.QuestChallenge
import villages.domain.QuestId
import villages.domain.Resource
import villages.domain.RewardNode
import villages.domain.Tincture
import villages.domain.Verdict
import villages.domain.WorldTime
import villages.domain.challenge.Aspect
import villages.domain.challenge.ChallengeCatalogue
import villages.domain.challenge.ChallengeEffect
import villages.domain.challenge.ChallengeKind
import villages.domain.challenge.ChallengeSlice
import villages.domain.challenge.Fires
import villages.domain.challenge.Side
import villages.domain.challenge.SummonSpec
import java.time.Instant
import java.util.UUID

/** Houses folded in memory with their real decider, and every event written. */
private class ChallengeHouses : HouseCommandExecutor {
    val streams = mutableMapOf<HouseId, MutableList<HouseEvent>>()
    val written = mutableListOf<HouseEvent>()

    override fun execute(command: HouseCommand, provenance: Provenance) {
        val held = streams.getOrPut(command.houseId) { mutableListOf() }
        val decided = HouseDecider.decide(command, HouseDecider.fold(held))
        held += decided
        written += decided
    }
}

/** A challenge a quest puts, fought here from a seed drawn here, and handed to the house with the quest's move on. */
class ChallengeServiceSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val today = WorldTime(653_705)
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val house = HouseId.of(ada)
    val sent = UUID.fromString("1c000007-0000-4000-8000-000000000071")

    val hirer = ChallengeSlice(Aspect.VIOLENCE, 50.0, 50.0, 1, listOf("violence.sellswords"))
    val idle = ChallengeSlice(Aspect.VIOLENCE, 50.0, 50.0, 1, emptyList())
    val content = ChallengeCatalogue(
        effects = listOf(ChallengeEffect("violence.sellswords", Aspect.VIOLENCE, Fires.TRIGGER, summons = "mercenary")),
        summons = mapOf("mercenary" to SummonSpec(Aspect.VIOLENCE, mapOf("pulls" to 10.0))),
        kinds = mapOf("skirmish" to ChallengeKind(5..9, 1..3, 0.0, mapOf(Aspect.REASON to 1.0))),
        starting = mapOf("hirer" to hirer),
    )
    val square = NodeId("square")
    val quest = Quest(
        id = QuestId(UUID.fromString("ee000000-0000-4000-8000-00000000a002")),
        title = "A skirmish",
        scene = null,
        nodes = listOf(
            ChallengeNode(
                square,
                "A rival's challenge",
                QuestChallenge("skirmish", Opponent("A rival", "#a8452a"), listOf(idle)),
                listOf(Edge(NodeId("prize"), verdict = Verdict.WON), Edge(NodeId("toll"), verdict = Verdict.LOST)),
            ),
            RewardNode(NodeId("toll"), "A toll", listOf(Effect.Grant(Resource.WEALTH, 1)), listOf(Edge(NodeId("prize")))),
            RewardNode(NodeId("prize"), "A prize", listOf(Effect.Grant(Resource.WEALTH, 10))),
        ),
    )

    fun rig(): Pair<ChallengeHouses, ChallengeService> {
        val houses = ChallengeHouses()
        val banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT)
        houses.execute(FoundHouse(house, ada, HouseName("Ravenscar"), Location(59.33, 18.07), banner, today, noon), Provenance.startedBy(UUID.randomUUID()))
        houses.execute(OfferQuest(house, quest, today, noon), Provenance.startedBy(UUID.randomUUID()))
        houses.written.clear()
        val rows = object : QuestsByHouse {
            override fun of(house: HouseId): List<QuestRow> = houses.streams[house].orEmpty().filterIsInstance<PlayerOfferedQuest>()
                .map { QuestRow(house, it.player, it.quest, emptyList(), QuestEnding.Open, "story", 1) }

            override fun watch(listener: (QuestsChange) -> Unit): AutoCloseable = AutoCloseable {}
        }
        val catalogues = Catalogues(TEST_STRUCTURES, TEST_BALANCE, TEST_FATE, TEST_NAMES, challenges = content)
        return houses to ChallengeService(houses, { noon }, { today }, rows, { catalogues }, { 41L }) { "fingerprint" }
    }

    "accepted, it is fought on the node's terms with the starting slices brought, from a seed drawn here, and the quest moves on" {
        val (houses, service) = rig()

        val id = service.accept(ada, quest.id, square, listOf("hirer"), Provenance.startedBy(sent))

        id shouldBe ChallengeId.accepted(house, sent)
        val resolved = houses.written.first().shouldBeInstanceOf<PlayerResolvedChallenge>()
        resolved.challengeId shouldBe id
        resolved.seed shouldBe 41L
        resolved.catalogue shouldBe "fingerprint"
        resolved.setup.a shouldBe listOf(hirer)
        resolved.setup.b shouldBe listOf(idle)
        resolved.brought shouldBe listOf("hirer")
        resolved.outcome.wonBy shouldBe Side.A
        houses.written[1] shouldBe PlayerCompletedQuestNode(house, ada, quest.id, square, NodeId("prize"), today, noon)
    }

    "a slice the house does not hold is fought not at all, and the house refuses it, writing nothing" {
        val (houses, service) = rig()

        shouldThrow<HouseError.NotAStartingSlice> { service.accept(ada, quest.id, square, listOf("sophist"), Provenance.startedBy(sent)) }
        houses.written shouldBe emptyList()
    }
})
