package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.util.UUID

/** The house: a quest offered whole, its first node reached from the same decision. The fixtures are QuestFixtures.kt. */
class HouseQuestsSpec : StringSpec({
    val abbot = Abbot.quest

    fun offering(quest: Quest = abbot) = OfferQuest(house, quest, day, noon)

    /** A quest of one node, under an id of its own, so that it can be offered beside the abbot's. */
    fun aReward(n: Int) = Quest(
        id = QuestId(UUID.fromString("ee000000-0000-4000-8000-%012d".format(n))),
        title = "A purse found",
        scene = null,
        nodes = listOf(RewardNode(NodeId("purse"), "A purse", listOf(Effect.Grant(Resource.WEALTH, 10)))),
    )

    "a house is offered a quest whole, for its own player, and its first dialogue is offered from the same decision" {
        val events = HouseDecider.decide(offering(), standing)

        events shouldBe listOf(
            PlayerOfferedQuest(house, player, abbot, day, noon),
            PlayerOfferedDialogue(house, player, Abbot.atTheGate, day, noon),
        )
        val holding = events.fold(standing, HouseDecider::evolve).shouldBeInstanceOf<House.Founded>()
        holding.openQuests shouldBe listOf(OpenQuest(abbot))
        holding.offeredQuests shouldBe setOf(abbot.id)
        holding.openDialogues.map { it.dialogue } shouldBe listOf(Abbot.atTheGate)
        holding.openQuests.single().walk().at shouldBe Abbot.gate
    }

    "a quest that starts at a reward or a checklist writes the offer alone: nothing happens until it is met" {
        HouseDecider.decide(offering(aReward(1)), standing) shouldBe listOf(PlayerOfferedQuest(house, player, aReward(1), day, noon))

        val startingAtTheGift = abbot.copy(nodes = abbot.nodes.drop(1).filter { it.id != Abbot.light })
        HouseDecider.decide(offering(startingAtTheGift), standing).single().shouldBeInstanceOf<PlayerOfferedQuest>()
    }

    "several quests can be open at once, in the order they were offered" {
        after(offering(), offering(aReward(2))).openQuests.map { it.quest.id } shouldBe listOf(abbot.id, aReward(2).id)
    }

    "the same quest offered twice is refused, which is what makes a resend harmless" {
        shouldThrow<HouseError.QuestAlreadyOffered> { HouseDecider.decide(offering(), after(offering())) }
    }

    "a quest is offered only to a house that exists" {
        shouldThrow<HouseError.NoSuchHouse> { HouseDecider.decide(offering(), HouseDecider.initial) }
    }
})
