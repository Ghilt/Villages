package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.application.QuestEnding
import villages.application.QuestRow
import villages.application.SampleQuests
import villages.domain.CharacterId
import villages.domain.DialogueNode
import villages.domain.HouseId
import villages.domain.NodeId
import villages.domain.ObjectiveId
import villages.domain.PlayerId
import villages.domain.QuestId
import villages.domain.QuestProgress
import villages.domain.Requirement
import villages.protocol.EndingView
import villages.protocol.ObjectiveView
import villages.protocol.QuestEdgeView
import villages.protocol.RequirementView
import java.util.UUID

/** What a player is sent of a quest: only what its walk draws, and nothing behind a question mark. */
class QuestViewsSpec : StringSpec({
    val player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val house = HouseId.of(player)
    val abbot = SampleQuests.named(SampleQuests.ABBOT, QuestId.offered(house, UUID.fromString("1c000007-0000-4000-8000-000000000060")))

    fun row(vararg progress: QuestProgress, ending: QuestEnding = QuestEnding.Open, quest: villages.domain.Quest = abbot) =
        QuestRow(house, player, quest, progress.toList(), ending, correlationId = "story", revision = 1).toView()

    "at the start the abbot is shown, the three hidden nodes are question marks with nothing more, and the blessing is in view" {
        val view = row()

        view.nodes.map { it.id to it.state } shouldBe listOf(
            "gate" to "current", "gift" to "ahead", "light" to "ahead", "consecration" to "ahead", "blessing" to "ahead",
        )
        val gate = view.nodes.first()
        gate.kind shouldBe "dialogue"
        gate.dialogueId shouldBe (abbot.start() as DialogueNode).dialogue.id.value.toString()
        for (hidden in view.nodes.filter { it.id in setOf("gift", "light", "consecration") }) {
            listOf(hidden.kind, hidden.title, hidden.dialogueId, hidden.objectives, hidden.gives) shouldBe listOf(null, null, null, null, null)
        }
        view.nodes.last().kind shouldBe "reward"
        view.nodes.last().gives?.size shouldBe 2
        view.nodes.map { it.row } shouldBe listOf(0, 1, 1, 2, 3)
        view.edges.map { it.state }.toSet() shouldBe setOf("ahead")
    }

    "answered badly, the castle's road is current with its checklist, and the cheap road is lost and shown for what it was" {
        val view = row(QuestProgress.Moved(NodeId("gate"), NodeId("light")), QuestProgress.Ticked(NodeId("light"), ObjectiveId("castle")))

        val gift = view.nodes.single { it.id == "gift" }
        gift.state shouldBe "lost"
        gift.title shouldBe "A gift to the mission"
        val light = view.nodes.single { it.id == "light" }
        light.objectives shouldBe listOf(
            ObjectiveView.Hold("castle", met = true, structureType = "castle", where = "island"),
            ObjectiveView.Deliver("wealth", met = false, resource = "wealth", amount = SampleQuests.LIGHT),
        )
        view.edges shouldBe listOf(
            QuestEdgeView("gate", "gift", "lost"),
            QuestEdgeView("gate", "light", "walked"),
            QuestEdgeView("gift", "consecration", "lost"),
            QuestEdgeView("light", "consecration", "ahead"),
            QuestEdgeView("consecration", "blessing", "ahead"),
        )
    }

    "a node that is not drawn is never sent, and an edge to or from it is a stub" {
        val hiddenMiddle = abbot.copy(
            nodes = abbot.nodes.map { if (it.id == NodeId("consecration")) (it as DialogueNode).copy(shownAhead = false) else it },
        )
        val view = row(quest = hiddenMiddle)

        view.nodes.map { it.id } shouldBe listOf("gate", "gift", "light", "blessing")
        view.edges.filter { it.from == null || it.to == null } shouldBe listOf(
            QuestEdgeView("gift", null, "ahead"),
            QuestEdgeView("light", null, "ahead"),
            QuestEdgeView(null, "blessing", "ahead"),
        )
    }

    "a quest ends as a dialogue does: finished, or lost with the requirement that failed" {
        row(ending = QuestEnding.Completed).ending shouldBe EndingView.Completed
        val agnes = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))
        row(ending = QuestEnding.Lost(Requirement.Alive(agnes))).ending shouldBe EndingView.Lost(RequirementView.Alive(agnes.value.toString()))
    }
})
