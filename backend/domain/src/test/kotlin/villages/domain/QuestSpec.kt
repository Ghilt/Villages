package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import java.util.UUID

class QuestSpec : StringSpec({
    val quest = Abbot.quest

    fun refusal(make: () -> Unit): String = shouldThrow<HouseError.InvalidQuest>(make).message.orEmpty()

    fun reward(id: String, vararg to: String) =
        RewardNode(NodeId(id), "The reward $id", listOf(Effect.Grant(Resource.WEALTH, 10)), to.map { Edge(NodeId(it)) })

    fun checklist(id: String, vararg objectives: Objective, to: List<Edge> = emptyList()) =
        ObjectiveNode(NodeId(id), "The checklist $id", objectives.toList(), to)

    fun deliver(id: String) = Objective.Deliver(ObjectiveId(id), Resource.WEALTH, 10)

    fun made(vararg nodes: QuestNode) = quest.copy(nodes = nodes.toList())

    "a quest is made whole, starts at its first node, and every node it leads to is its own" {
        quest.start shouldBe Abbot.gateNode
        quest.node(Abbot.blessing) shouldBe Abbot.blessingNode
        quest.node(NodeId("nowhere")) shouldBe null
    }

    "one reward is a whole quest" {
        made(reward("only")).nodes.size shouldBe 1
    }

    "a quest has a title and a node to start at" {
        refusal { quest.copy(title = " ") } shouldContain "title"
        refusal { made() } shouldContain "start"
    }

    "an id is a word, no two nodes share one, and no two objectives of one node" {
        refusal { made(reward("two words")) } shouldContain "\"two words\""
        refusal { made(reward("a".repeat(Quest.LONGEST_ID + 1))) } shouldContain "id is a word"
        refusal { made(reward("first", "again"), reward("again"), reward("again")) } shouldContain "share"
        refusal { made(checklist("list", deliver("same"), deliver("same"))) } shouldContain "share"
        made(checklist("one", deliver("same"), to = listOf(Edge(NodeId("two")))), checklist("two", deliver("same")))
            .nodes.size shouldBe 2
    }

    "every node has a title, and leads only to nodes the quest has, by one edge each" {
        refusal { made(reward("only").copy(title = "")) } shouldContain "no title"
        refusal { made(reward("first", "gone")) } shouldContain "gone"
        refusal { made(reward("first").copy(edges = listOf(Edge(NodeId("next")), Edge(NodeId("next")))), reward("next")) } shouldContain
            "two edges to one node"
    }

    "no node can be reached from itself, and every node is reached from the start" {
        refusal { made(reward("a", "b"), reward("b", "a")) } shouldContain "reached from itself"
        refusal { made(reward("a"), reward("nobody")) } shouldContain "nothing leads to node nobody"
    }

    "only a dialogue's ending can decide a fork" {
        refusal { made(reward("fork", "a", "b"), reward("a"), reward("b")) } shouldContain "a reward cannot decide"
        refusal { made(checklist("fork", deliver("d"), to = listOf(Edge(NodeId("a")), Edge(NodeId("b")))), reward("a"), reward("b")) } shouldContain
            "a checklist cannot decide"
        refusal { made(checklist("list", deliver("d"), to = listOf(Edge(NodeId("a"), setOf(Abbot.pleased)))), reward("a")) } shouldContain
            "has no dialogue"
    }

    "where a dialogue node forks, every ending of its dialogue leads along exactly one edge" {
        fun gate(vararg edges: Edge) = made(Abbot.gateNode.copy(edges = edges.toList()), reward("gift"), reward("light"))
        val gift = NodeId("gift")
        val light = NodeId("light")

        refusal { gate(Edge(gift, setOf(Abbot.pleased)), Edge(light)) } shouldContain "names no ending"
        refusal { gate(Edge(gift, setOf(LineId("faith"))), Edge(light, setOf(Abbot.doubts))) } shouldContain
            "faith, which does not end"
        refusal { gate(Edge(gift, setOf(Abbot.pleased, Abbot.doubts)), Edge(light, setOf(Abbot.doubts))) } shouldContain
            "two ways after one ending"
        refusal { gate(Edge(gift, setOf(Abbot.pleased)), Edge(light, setOf(Abbot.pleased))) } shouldContain
            "two ways after one ending"
        refusal { made(Abbot.gateNode.copy(edges = listOf(Edge(gift, setOf(Abbot.pleased)))), reward("gift")) } shouldContain
            "leads nowhere after doubts"
    }

    "a dialogue node with one edge goes that way however its dialogue ends, and with none it ends the quest" {
        made(Abbot.gateNode.copy(edges = listOf(Edge(NodeId("on")))), reward("on")).nodes.size shouldBe 2
        made(Abbot.gateNode.copy(edges = listOf(Edge(NodeId("on"), setOf(Abbot.pleased, Abbot.doubts)))), reward("on"))
            .nodes.size shouldBe 2
        made(Abbot.gateNode.copy(edges = emptyList())).nodes.size shouldBe 1
    }

    "a dialogue node's dialogue is under the id worked out from the quest and the node" {
        val elsewhere = Abbot.atTheGate.copy(id = DialogueId.ofNode(quest.id, NodeId("elsewhere")))
        refusal { made(Abbot.gateNode.copy(dialogue = elsewhere, edges = emptyList())) } shouldContain "not under the id"
        refusal { quest.copy(id = QuestId(UUID.randomUUID())) } shouldContain "not under the id"
    }

    "a checklist holds one to six objectives, and a reward gives something" {
        refusal { made(checklist("empty")) } shouldContain "holds 0 objectives"
        refusal { made(checklist("long", *(1..7).map { deliver("d$it") }.toTypedArray())) } shouldContain "holds 7"
        made(checklist("full", *(1..ObjectiveNode.MOST).map { deliver("d$it") }.toTypedArray())).nodes.size shouldBe 1
        refusal { made(reward("nothing").copy(gives = emptyList())) } shouldContain "gives nothing"
    }

    "an objective asks for more than nothing, and a pledge for a month at least" {
        shouldThrow<HouseError.InvalidAmount> { Objective.Deliver(ObjectiveId("d"), Resource.WEALTH, 0) }
        shouldThrow<HouseError.InvalidAmount> { Objective.Pledge(ObjectiveId("p"), Resource.PIETY, -5, months = 6) }
        refusal { Objective.Pledge(ObjectiveId("p"), Resource.PIETY, 5, months = 0) } shouldContain "a month at least"
    }

    "objectives come in two families: what the player meets and what the world meets" {
        quest.nodes.filterIsInstance<ObjectiveNode>().flatMap { it.objectives }.map { it is Objective.MetByThePlayer } shouldBe
            listOf(true, false, true)
    }

    "a quest's id is worked out from the house and the command, and its dialogues' from the quest and the node" {
        val house = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"))
        val other = HouseId(UUID.fromString("7e6c1b3f-2d40-4e8f-ab9c-102f3e4d5c6b"))
        val command = UUID.fromString("c0000000-0000-4000-8000-000000000001")

        QuestId.offered(house, command) shouldBe QuestId.offered(house, command)
        QuestId.offered(house, command) shouldNotBe QuestId.offered(other, command)
        DialogueId.ofNode(quest.id, Abbot.gate) shouldBe Abbot.atTheGate.id
        DialogueId.ofNode(quest.id, Abbot.gate) shouldNotBe DialogueId.ofNode(quest.id, Abbot.consecration)
        DialogueId.ofNode(quest.id, Abbot.gate) shouldNotBe DialogueId.offered(house, quest.id.value)
    }
})
