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

    // ---- objectives met, rewards collected --------------------------------------------------------

    /** The abbot's quest from one of its checklists on, which is where a quest stands once its dialogue is done. */
    fun from(node: NodeId) = abbot.copy(
        nodes = abbot.nodes.dropWhile { it.id != node }.filter { it.id == node || it.id !in setOf(Abbot.gift, Abbot.light) },
    )
    val atTheLight = from(Abbot.light)
    val atTheGift = from(Abbot.gift)
    val terms = Pledging(PledgeId(UUID.fromString("ee000000-0000-4000-8000-00000000d101")), later)

    fun meeting(objective: ObjectiveId, node: NodeId = Abbot.light, pledging: Pledging? = null, quest: Quest = atTheLight) =
        MeetObjective(house, quest.id, node, objective, day, noon, pledging)
    fun marking(objective: ObjectiveId, node: NodeId = Abbot.light) = MarkObjectiveMet(house, atTheLight.id, node, objective, day, noon)
    fun collecting(quest: Quest, node: NodeId) = CollectReward(house, quest.id, node, day, noon)

    "a delivery is ticked and paid from one decision, the tick first, and the quest stays while the checklist wants more" {
        val events = HouseDecider.decide(meeting(Abbot.wealth), after(granting(Resource.WEALTH, 100), offering(atTheLight)))

        events shouldBe listOf(
            PlayerMetQuestObjective(house, player, atTheLight.id, Abbot.light, Abbot.wealth, day, noon),
            HouseResourceSpent(house, Resource.WEALTH, 60, day, noon),
        )
        val paid = after(granting(Resource.WEALTH, 100), offering(atTheLight), meeting(Abbot.wealth))
        paid.openQuests.single().walk().ticked shouldBe setOf(Abbot.wealth)
        paid.stockOf(Resource.WEALTH).at(noon) shouldBe 40
    }

    "a delivery the house cannot pay is refused, and nothing is ticked" {
        shouldThrow<HouseError.NotEnoughFree> { HouseDecider.decide(meeting(Abbot.wealth), after(offering(atTheLight))) }
    }

    "a pledge ties the amount to the quest under its title, and the last objective moves the quest on to its next dialogue" {
        val events = HouseDecider.decide(
            meeting(Abbot.piety, Abbot.gift, terms, atTheGift),
            after(granting(Resource.PIETY, 30), offering(atTheGift)),
        )

        events shouldBe listOf(
            PlayerMetQuestObjective(house, player, atTheGift.id, Abbot.gift, Abbot.piety, day, noon),
            HouseResourcePledged(house, terms.pledgeId, Resource.PIETY, 30, later, "The abbot of the isle", day, noon),
            PlayerCompletedQuestNode(house, player, atTheGift.id, Abbot.gift, Abbot.consecration, day, noon),
            PlayerOfferedDialogue(house, player, Abbot.blesses, day, noon),
        )
        shouldThrow<HouseError.InvalidPledge> {
            HouseDecider.decide(meeting(Abbot.piety, Abbot.gift, null, atTheGift), after(granting(Resource.PIETY, 30), offering(atTheGift)))
        }
    }

    "the world's objective is ticked by a mark and costs nothing; the player cannot press for it, nor the world tick a cost" {
        val standingAtTheLight = after(offering(atTheLight))

        HouseDecider.decide(marking(Abbot.castle), standingAtTheLight) shouldBe
            listOf(PlayerMetQuestObjective(house, player, atTheLight.id, Abbot.light, Abbot.castle, day, noon))
        shouldThrow<HouseError.NotThePlayersToMeet> { HouseDecider.decide(meeting(Abbot.castle), standingAtTheLight) }
        shouldThrow<HouseError.NotTheWorldsToMeet> { HouseDecider.decide(marking(Abbot.wealth), standingAtTheLight) }
    }

    "a checklist ticked in any order moves on with its last tick, whichever family that tick is in" {
        val built = after(granting(Resource.WEALTH, 100), offering(atTheLight), marking(Abbot.castle))

        HouseDecider.decide(meeting(Abbot.wealth), built).map { it::class } shouldBe listOf(
            PlayerMetQuestObjective::class, HouseResourceSpent::class, PlayerCompletedQuestNode::class, PlayerOfferedDialogue::class,
        )
        val paidFirst = after(granting(Resource.WEALTH, 100), offering(atTheLight), meeting(Abbot.wealth))
        HouseDecider.decide(marking(Abbot.castle), paidFirst).map { it::class } shouldBe
            listOf(PlayerMetQuestObjective::class, PlayerCompletedQuestNode::class, PlayerOfferedDialogue::class)
    }

    "an objective is ticked once, only at the node the quest stands at, and only one that node asks for" {
        val ticked = after(offering(atTheLight), marking(Abbot.castle))

        shouldThrow<HouseError.ObjectiveAlreadyMet> { HouseDecider.decide(marking(Abbot.castle), ticked) }
        shouldThrow<HouseError.NoSuchObjective> { HouseDecider.decide(marking(ObjectiveId("nothing")), ticked) }
        shouldThrow<HouseError.NotTheCurrentNode> { HouseDecider.decide(meeting(Abbot.piety, Abbot.gift, terms, abbot), after(offering())) }
        shouldThrow<HouseError.NoSuchObjective> { HouseDecider.decide(meeting(Abbot.piety, Abbot.gate, terms, abbot), after(offering())) }
        shouldThrow<HouseError.NoSuchQuest> { HouseDecider.decide(meeting(Abbot.wealth), standing) }
    }

    "collecting a reward moves past it, pays it, and finishes the quest, once" {
        val purse = aReward(3)
        val events = HouseDecider.decide(collecting(purse, NodeId("purse")), after(offering(purse)))

        events shouldBe listOf(
            PlayerCompletedQuestNode(house, player, purse.id, NodeId("purse"), null, day, noon),
            HouseResourceGranted(house, Resource.WEALTH, 10, day, noon),
            PlayerCompletedQuest(house, player, purse.id, day, noon),
        )
        val done = after(offering(purse), collecting(purse, NodeId("purse")))
        done.openQuests shouldBe emptyList()
        done.offeredQuests shouldBe setOf(purse.id)
        done.stockOf(Resource.WEALTH).at(noon) shouldBe 10
        shouldThrow<HouseError.QuestOver> { HouseDecider.decide(collecting(purse, NodeId("purse")), done) }
    }

    "only a reward is collected, and only where the quest stands" {
        shouldThrow<HouseError.NotAReward> { HouseDecider.decide(collecting(abbot, Abbot.gate), after(offering())) }
        shouldThrow<HouseError.NotTheCurrentNode> { HouseDecider.decide(collecting(abbot, Abbot.blessing), after(offering())) }
    }

    // ---- a dialogue node moves the quest on -------------------------------------------------------

    val atTheGate = Abbot.atTheGate.id
    fun saying(line: String, dialogue: DialogueId = atTheGate) = CompleteDialogueStep(house, dialogue, LineId(line), day, noon)

    "answered well, the dialogue's end moves the quest to the gift and loses the castle's road, from the same decision" {
        val events = HouseDecider.decide(saying("pleased"), after(offering(), saying("faith")))

        events shouldBe listOf(
            PlayerCompletedDialogueStep(house, player, atTheGate, LineId("pleased"), day, noon),
            PlayerCompletedDialogue(house, player, atTheGate, day, noon),
            PlayerCompletedQuestNode(house, player, abbot.id, Abbot.gate, Abbot.gift, day, noon),
            PlayerLostQuestNode(house, player, abbot.id, Abbot.light, day, noon),
        )
        val walk = after(offering(), saying("faith"), saying("pleased")).openQuests.single().walk()
        walk.at shouldBe Abbot.gift
        walk.lost shouldBe listOf(Abbot.light)
    }

    "answered badly, the cheap road is the one lost, and the quest stands at the castle and the delivery" {
        val events = HouseDecider.decide(saying("doubts"), after(offering(), saying("wealth")))

        events.filterIsInstance<PlayerCompletedQuestNode>().single().onto shouldBe Abbot.light
        events.filterIsInstance<PlayerLostQuestNode>().map { it.nodeId } shouldBe listOf(Abbot.gift)
    }

    "a dialogue node with one edge goes that way, and the whole road ends at the blessing collected" {
        val atTheConsecration =
            after(offering(atTheGift), granting(Resource.PIETY, 30), meeting(Abbot.piety, Abbot.gift, terms, atTheGift))

        val events = HouseDecider.decide(saying("blesses", Abbot.blesses.id), atTheConsecration)
        events.filterIsInstance<PlayerCompletedQuestNode>().single().onto shouldBe Abbot.blessing
        events.filterIsInstance<PlayerLostQuestNode>() shouldBe emptyList()

        val blessed = after(
            offering(atTheGift), granting(Resource.PIETY, 30), meeting(Abbot.piety, Abbot.gift, terms, atTheGift),
            saying("blesses", Abbot.blesses.id), collecting(atTheGift, Abbot.blessing),
        )
        blessed.openQuests shouldBe emptyList()
        blessed.stockOf(Resource.INFLUENCE).at(noon) shouldBe 40
    }

    "a quest that ends at a dialogue node is finished when the dialogue is" {
        val talk = abbot.copy(nodes = listOf(Abbot.gateNode.copy(edges = emptyList())))

        HouseDecider.decide(saying("pleased"), after(offering(talk), saying("faith"))).takeLast(2) shouldBe listOf(
            PlayerCompletedQuestNode(house, player, talk.id, Abbot.gate, null, day, noon),
            PlayerCompletedQuest(house, player, talk.id, day, noon),
        )
    }

    "a dialogue lost at a quest's node loses the quest for the same reason, and nothing more can be done in it" {
        val agnes = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))
        val needing = Abbot.atTheGate.copy(requirements = listOf(Requirement.Alive(agnes)))
        val needy = abbot.copy(nodes = listOf(Abbot.gateNode.copy(dialogue = needing)) + abbot.nodes.drop(1))
        val dying = FailRequirement(house, Requirement.Alive(agnes), day, noon)

        HouseDecider.decide(dying, after(offering(needy))) shouldBe listOf(
            PlayerLostDialogue(house, player, atTheGate, Requirement.Alive(agnes), day, noon),
            PlayerLostQuest(house, player, needy.id, Requirement.Alive(agnes), day, noon),
        )
        val lost = after(offering(needy), dying)
        lost.openQuests shouldBe emptyList()
        shouldThrow<HouseError.QuestOver> { HouseDecider.decide(collecting(needy, Abbot.blessing), lost) }
    }
})
