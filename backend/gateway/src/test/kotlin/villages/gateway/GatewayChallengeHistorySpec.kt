package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import villages.domain.PlayerResolvedChallenge
import villages.domain.challenge.Side
import villages.protocol.ChallengeRun
import villages.protocol.CommandAccepted
import villages.protocol.ErrorFrame
import villages.protocol.OpponentView
import villages.protocol.ServerFrame
import villages.protocol.YourChallenges
import villages.protocol.YourQuests

/** The gateway: a challenge a quest puts, accepted over the socket, and the history its player is told. */
class GatewayChallengeHistorySpec : StringSpec({

    "hello says which challenges the house has fought, right after its quests, and none before it has fought any" {
        val sent = mutableListOf<ServerFrame>()
        Rig().connect { sent += it }.receive(hello)

        sent.filterIsInstance<YourChallenges>().single().challenges.shouldBeEmpty()
        sent.indexOfFirst { it is YourChallenges } shouldBe sent.indexOfFirst { it is YourQuests } + 1
    }

    "a challenge accepted is told in the history: who stood against whom, what it was, how it ended, and the road taken" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(offeringAQuest("skirmish", commandNumber(1)))
        val quest = sent.filterIsInstance<YourQuests>().last().quests.single()

        mine.receive(acceptingChallenge(quest.id, "field", listOf("hirer", "envoy"), commandNumber(2)))

        sent.filterIsInstance<CommandAccepted>().last() shouldBe CommandAccepted(commandNumber(2))
        val fought = rig.world.events.filterIsInstance<PlayerResolvedChallenge>().single()
        val row = sent.filterIsInstance<YourChallenges>().last().challenges.single()
        row.id shouldBe fought.challengeId.value.toString()
        row.title shouldBe "The reeve's men at the ford"
        row.quest shouldBe "The reeve's skirmish"
        row.kind shouldBe "skirmish"
        row.house shouldBe "Ravenscar"
        row.against shouldBe OpponentView("The reeve", "#556b2f")
        row.brought shouldBe listOf("hirer", "envoy")
        row.outcome.wonBy shouldBe fought.outcome.wonBy?.name?.lowercase()
        row.then shouldBe if (fought.outcome.wonBy == Side.A) "The spoils" else "The toll"
    }

    "another player is told nothing of a challenge that is not theirs" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        val (_, overheard) = rig.someoneElse()
        mine.receive(founding())
        mine.receive(offeringAQuest("skirmish", commandNumber(1)))
        val quest = sent.filterIsInstance<YourQuests>().last().quests.single()

        mine.receive(acceptingChallenge(quest.id, "field", listOf("hirer"), commandNumber(2)))

        sent.filterIsInstance<YourChallenges>().last().challenges shouldHaveSize 1
        overheard.filterIsInstance<YourChallenges>().shouldBeEmpty()
    }

    "a challenge fought is watched again: both sides' slices, its moments fought again, and what it came to as recorded" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(offeringAQuest("skirmish", commandNumber(1)))
        val quest = sent.filterIsInstance<YourQuests>().last().quests.single()
        mine.receive(acceptingChallenge(quest.id, "field", listOf("hirer"), commandNumber(2)))
        val row = sent.filterIsInstance<YourChallenges>().last().challenges.single()
        row.questId shouldBe quest.id
        row.nodeId shouldBe "field"

        mine.receive("""{"type":"watchChallenge","challengeId":"${row.id}"}""")

        val run = sent.last() as ChallengeRun
        run.id shouldBe row.id
        run.sides.a.single().effects shouldBe listOf("violence.sellswords")
        run.sides.b.single().aspect shouldBe "violence"
        run.outcome shouldBe row.outcome
        run.moments.isNotEmpty() shouldBe true
        run.differs shouldBe false
    }

    "a challenge the house did not fight, or no challenge at all, is not one to watch" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())

        mine.receive("""{"type":"watchChallenge","challengeId":"c4000000-0000-4000-8000-0000000000d1"}""")
        (sent.last() as ErrorFrame).code shouldBe "noSuchChallenge"

        mine.receive("""{"type":"watchChallenge","challengeId":"not an id"}""")
        (sent.last() as ErrorFrame).code shouldBe "noSuchChallenge"
    }
})
