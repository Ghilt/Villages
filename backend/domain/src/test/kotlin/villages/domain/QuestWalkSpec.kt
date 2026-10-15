package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import villages.domain.Abbot.blessing
import villages.domain.Abbot.castle
import villages.domain.Abbot.consecration
import villages.domain.Abbot.gate
import villages.domain.Abbot.gift
import villages.domain.Abbot.light
import villages.domain.Abbot.piety
import villages.domain.Abbot.wealth
import villages.domain.QuestProgress.Moved
import villages.domain.QuestProgress.Ticked

class QuestWalkSpec : StringSpec({
    val quest = Abbot.quest
    val every = quest.nodes.map { it.id }

    fun walked(vararg progress: QuestProgress) = quest.walk(progress.toList())
    fun drawn(walk: QuestWalk) = every.filter(walk::isDrawn)
    fun questionMarks(walk: QuestWalk) = every.filter(walk::isQuestionMark)
    fun edges(walk: QuestWalk) = quest.nodes.flatMap { node -> node.edges.map { "${node.id.value}>${it.to.value}" to walk.stateOf(node.id, it) } }
        .toMap()

    val wentBadly = arrayOf<QuestProgress>(Moved(gate, light))
    val builtAndPaid = wentBadly + arrayOf(Ticked(light, castle), Ticked(light, wealth))
    val wholeRoad = builtAndPaid + arrayOf(Moved(light, consecration), Moved(consecration, blessing), Moved(blessing, null))

    "a quest nobody has moved through stands at its start, with the nodes one edge ahead and those shown ahead drawn" {
        val start = walked()

        start shouldBe QuestWalk(quest, at = gate, done = emptyList(), lost = emptyList(), ticked = emptySet())
        start.over.shouldBeFalse()
        drawn(start) shouldBe every
        questionMarks(start) shouldBe listOf(gift, light, consecration)
        edges(start).values.toSet() shouldBe setOf(EdgeState.AHEAD)
    }

    "answered well, the quest moves to the gift and loses the castle's road, shown for what it is" {
        val well = walked(Moved(gate, gift))

        well.at shouldBe gift
        well.done shouldBe listOf(gate)
        well.lost shouldBe listOf(light)
        well.stateOf(light) shouldBe NodeState.LOST
        questionMarks(well) shouldBe listOf(consecration)
        edges(well) shouldBe mapOf(
            "gate>gift" to EdgeState.WALKED,
            "gate>light" to EdgeState.LOST,
            "gift>consecration" to EdgeState.AHEAD,
            "light>consecration" to EdgeState.LOST,
            "consecration>blessing" to EdgeState.AHEAD,
        )
    }

    "answered badly, the cheap road is the one lost" {
        val badly = walked(*wentBadly)

        badly.at shouldBe light
        badly.lost shouldBe listOf(gift)
        badly.isDrawn(gift).shouldBeTrue()
        badly.isQuestionMark(gift).shouldBeFalse()
    }

    "a checklist is ticked in any order, and the quest moves past it only once every objective is" {
        walked(*wentBadly, Ticked(light, wealth)).ticked shouldBe setOf(wealth)
        walked(*builtAndPaid).ticked shouldBe setOf(castle, wealth)

        shouldThrow<IllegalArgumentException> { walked(*wentBadly, Ticked(light, wealth), Moved(light, consecration)) }
            .message shouldContain "checklist unticked"

        val joined = walked(*builtAndPaid, Moved(light, consecration))
        joined.at shouldBe consecration
        joined.ticked shouldBe emptySet()
        joined.lost shouldBe listOf(gift)
    }

    "the whole road ends past the reward, the other road lost once and only once" {
        val ended = walked(*wholeRoad)

        ended.over.shouldBeTrue()
        ended.at shouldBe null
        ended.done shouldBe listOf(gate, light, consecration, blessing)
        ended.lost shouldBe listOf(gift)
        edges(ended).filterValues { it == EdgeState.WALKED }.keys shouldBe
            setOf("gate>light", "light>consecration", "consecration>blessing")
    }

    "what was recorded must follow a road, or the walk refuses it rather than guess" {
        fun refused(vararg progress: QuestProgress) = shouldThrow<IllegalArgumentException> { walked(*progress) }.message

        refused(Moved(gift, consecration)) shouldContain "it stands at gate"
        refused(Ticked(gate, piety)) shouldContain "no checklist"
        refused(Moved(gate, gift), Ticked(gift, castle)) shouldContain "has no objective castle"
        refused(Moved(gate, gift), Ticked(gift, piety), Ticked(gift, piety)) shouldContain "ticked twice"
        refused(Moved(gate, null)) shouldContain "which leads on"
        refused(Moved(gate, blessing)) shouldContain "no edge to blessing"
        refused(*wholeRoad, Moved(blessing, null)) shouldContain "after its end"
    }

    "a node two edges ahead is not drawn unless it is shown ahead, and a lost one beyond the road is not drawn either" {
        val start = quest.node(gate) as DialogueNode
        fun reward(id: String, vararg to: String) =
            RewardNode(NodeId(id), "The reward $id", listOf(Effect.Grant(Resource.WEALTH, 10)), to.map { Edge(NodeId(it)) })
        val fork = quest.copy(
            nodes = listOf(
                start.copy(edges = listOf(Edge(gift, setOf(Abbot.pleased)), Edge(light, setOf(Abbot.doubts)))),
                reward("gift", "beyond"),
                reward("beyond"),
                reward("light"),
            ),
        )

        fork.walk(emptyList()).isDrawn(NodeId("beyond")).shouldBeFalse()
        fork.copy(shownFromTheStart = true).walk(emptyList()).isDrawn(NodeId("beyond")).shouldBeTrue()

        val tookLight = fork.walk(listOf(Moved(gate, light)))
        tookLight.lost shouldBe listOf(gift, NodeId("beyond"))
        tookLight.isDrawn(gift).shouldBeTrue()
        tookLight.isDrawn(NodeId("beyond")).shouldBeFalse()
        fork.cutOffBy(gate, light) shouldBe listOf(gift, NodeId("beyond"))
    }

    "each node stands as far down as the longest road to it" {
        quest.rows() shouldBe mapOf(gate to 0, gift to 1, light to 1, consecration to 2, blessing to 3)
        quest.cutOffBy(gate, gift) shouldBe listOf(light)
        quest.cutOffBy(light, consecration) shouldBe emptyList()
    }
})
