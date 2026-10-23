package villages.projections

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import villages.application.ChallengesChange
import villages.application.EventFeed
import villages.application.Start
import villages.application.StoredEvent
import villages.application.started
import villages.domain.Banner
import villages.domain.ChallengeId
import villages.domain.ChallengeNode
import villages.domain.Charge
import villages.domain.Division
import villages.domain.Edge
import villages.domain.Effect
import villages.domain.HouseEvent
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.NodeId
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
import villages.domain.Significance
import villages.domain.Tincture
import villages.domain.Verdict
import villages.domain.WorldTime
import villages.domain.challenge.Aspect
import villages.domain.challenge.ChallengeSetup
import villages.domain.challenge.ChallengeSlice
import villages.domain.challenge.Ending
import villages.domain.challenge.Happening
import villages.domain.challenge.Outcome
import villages.domain.challenge.Progression
import villages.domain.challenge.Side
import java.time.Instant
import java.util.UUID

/** A feed that delivers what it is handed, when it is handed it. */
private class ChallengesFed : EventFeed {
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    fun deliver(event: HouseEvent) {
        val record = StoredEvent(
            id = UUID.randomUUID().toString(),
            type = "villages.player.x.v1",
            stream = event.houseId.stream,
            streamVersion = 1L,
            time = event.recordedAt,
            data = "{}",
            correlationId = "a-story",
            causationId = UUID.randomUUID().toString(),
            event = event,
        )
        subscribers.toList().forEach { it(record) }
    }
}

class ChallengesProjectionSpec : StringSpec({
    val noon = Instant.parse("2026-10-23T12:00:00Z")
    val day = WorldTime(653_705)
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val house = HouseId.of(ada)
    val anselm = Opponent("Brother Anselm", "#a8452a")
    val reason = ChallengeSlice(Aspect.REASON, power = 50.0, integrity = 50.0, summonCount = 3, effects = listOf("reason.counsel"))

    val square = NodeId("square")
    val blessing = NodeId("blessing")
    val consolation = NodeId("consolation")
    val quest = Quest(
        id = QuestId(UUID.fromString("ee000000-0000-4000-8000-00000000c001")),
        title = "The debate in the square",
        scene = null,
        nodes = listOf(
            ChallengeNode(
                square,
                "Brother Anselm's challenge",
                QuestChallenge("debate", anselm, listOf(reason)),
                edges = listOf(Edge(blessing, verdict = Verdict.WON), Edge(consolation, verdict = Verdict.LOST)),
            ),
            RewardNode(blessing, "The brother's blessing", listOf(Effect.Grant(Resource.PIETY, 50)), shownAhead = true),
            RewardNode(consolation, "A crust of bread", listOf(Effect.Grant(Resource.WEALTH, 5)), shownAhead = false),
        ),
    )

    val founded = HouseFounded(
        houseId = house,
        player = ada,
        name = HouseName("House Varga"),
        seat = Location(59.33, 18.06),
        significance = Significance(1.0),
        banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
        resources = emptyMap(),
        worldTime = day,
        recordedAt = noon,
    )
    fun fought(at: NodeId, id: String = "c4000000-0000-4000-8000-0000000000d1") = PlayerResolvedChallenge(
        houseId = house,
        player = ada,
        challengeId = ChallengeId(UUID.fromString(id)),
        questId = quest.id,
        nodeId = at,
        kind = "debate",
        against = anselm,
        brought = listOf("scholar"),
        setup = ChallengeSetup(a = listOf(reason), b = listOf(reason), progression = Progression(30, listOf(Happening(Aspect.REASON)))),
        seed = 4242L,
        catalogue = "3f1c2a",
        engine = 2,
        outcome = Outcome(tug = 41.5, ended = Ending.TIME_RAN_OUT, second = 30, wonBy = Side.A, gains = emptyList(), losses = emptyList()),
        worldTime = day,
        recordedAt = noon,
    )
    fun moved(from: NodeId, onto: NodeId?) = PlayerCompletedQuestNode(house, ada, quest.id, from, onto, day, noon)

    "a challenge fought is held for its house, named by its node and its quest, with the house's name, and no road yet" {
        val feed = ChallengesFed()
        val challenges = ChallengesProjection(feed).started()

        feed.deliver(founded)
        feed.deliver(PlayerOfferedQuest(house, ada, quest, day, noon))
        feed.deliver(fought(square))

        val row = challenges.of(house).single()
        row.title shouldBe "Brother Anselm's challenge"
        row.questTitle shouldBe "The debate in the square"
        row.houseName shouldBe "House Varga"
        row.against shouldBe anselm
        row.outcome.wonBy shouldBe Side.A
        row.foughtAt shouldBe noon
        row.then shouldBe null
        row.revision shouldBe 1
    }

    "the quest's move written after it names where the quest went on to, and counts the change" {
        val feed = ChallengesFed()
        val challenges = ChallengesProjection(feed).started()
        feed.deliver(PlayerOfferedQuest(house, ada, quest, day, noon))
        feed.deliver(fought(square))

        feed.deliver(moved(square, blessing))

        val row = challenges.of(house).single()
        row.then shouldBe "The brother's blessing"
        row.revision shouldBe 2
    }

    "a challenge that was its quest's last step says so, and a move from elsewhere in the quest changes nothing" {
        val feed = ChallengesFed()
        val challenges = ChallengesProjection(feed).started()
        feed.deliver(PlayerOfferedQuest(house, ada, quest, day, noon))
        feed.deliver(fought(square))

        feed.deliver(moved(blessing, null))
        challenges.of(house).single().then shouldBe null

        feed.deliver(moved(square, null))
        challenges.of(house).single().then shouldBe ChallengesProjection.THE_END
    }

    "every change is told to its watchers, and a reset forgets every challenge" {
        val feed = ChallengesFed()
        val challenges = ChallengesProjection(feed).started()
        val heard = mutableListOf<ChallengesChange>()
        challenges.watch { heard += it }
        feed.deliver(PlayerOfferedQuest(house, ada, quest, day, noon))

        feed.deliver(fought(square))
        feed.deliver(moved(square, blessing))

        heard shouldHaveSize 2
        heard.last().player shouldBe ada
        heard.last().challenges.single().then shouldBe "The brother's blessing"

        challenges.reset()
        challenges.of(house).shouldBeEmpty()
    }
})
