package villages.domain

/**
 * Where a quest has got to, worked out from what the house recorded of it: the node it stands at, the nodes
 * done and lost, the objectives ticked where it stands, and from those what is drawn and how.
 *
 * What is done and lost is recorded; how any of it is drawn never is. This is how it is worked out, and the
 * decider and what the player is sent both read it, so the two cannot come to disagree about where a quest
 * stands or what is on its map. See decision record 0096.
 */
data class QuestWalk(
    val quest: Quest,
    /** The node it stands at, or none once it has moved past its last. */
    val at: NodeId?,
    /** The nodes it moved past, in the order it did. */
    val done: List<NodeId>,
    /** The nodes it can no longer reach, because the road taken does not lead there, in the order they were lost. */
    val lost: List<NodeId>,
    /** The objectives ticked at the node it stands at. */
    val ticked: Set<ObjectiveId>,
) {
    /** Whether it has moved past its last node. */
    val over: Boolean get() = at == null

    fun stateOf(node: NodeId): NodeState = when (node) {
        at -> NodeState.CURRENT
        in done -> NodeState.DONE
        in lost -> NodeState.LOST
        else -> NodeState.AHEAD
    }

    /**
     * Whether a node is on the map at all: every node done, the one it stands at, every node one edge from any
     * of those - the lost ones beside the road included - and every node shown ahead. The rest stays on the
     * server, an edge to one of them drawn as a stub.
     */
    fun isDrawn(node: NodeId): Boolean {
        val written = quest.node(node) ?: return false
        if (quest.shownFromTheStart || written.shownAhead) return true
        val road = done + listOfNotNull(at)
        return node in road || road.any { from -> quest.node(from)!!.edges.any { edge -> edge.to == node } }
    }

    /** Whether a node is drawn as a question mark: hidden, and neither reached nor lost, which show it for what it is. */
    fun isQuestionMark(node: NodeId): Boolean = quest.node(node)?.hidden == true && stateOf(node) == NodeState.AHEAD

    /**
     * How an edge out of a node is drawn: walked when the quest moved along it; lost when it never can, because
     * the node it leaves is done or lost or the node it reaches is lost; and otherwise ahead.
     */
    fun stateOf(from: NodeId, edge: Edge): EdgeState {
        val road = done + listOfNotNull(at)
        val walked = road.zipWithNext().any { (a, b) -> a == from && b == edge.to }
        return when {
            walked -> EdgeState.WALKED
            stateOf(from) == NodeState.DONE || stateOf(from) == NodeState.LOST || edge.to in lost -> EdgeState.LOST
            else -> EdgeState.AHEAD
        }
    }
}

/** What a node is to the quest now. */
enum class NodeState { DONE, CURRENT, AHEAD, LOST }

/** What an edge is to the quest now. */
enum class EdgeState { WALKED, AHEAD, LOST }

/** One thing the house recorded of a quest, in the order it did: what the walk is worked out from. */
sealed interface QuestProgress {
    /** An objective of the node the quest stood at was ticked. */
    data class Ticked(val node: NodeId, val objective: ObjectiveId) : QuestProgress

    /** The quest moved past a node, onto the next, or to the end with none. */
    data class Moved(val from: NodeId, val onto: NodeId?) : QuestProgress
}

/**
 * Where this quest stands after what the house recorded of it, in the order it was recorded.
 *
 * The house records only what its rules allow, so progress that follows no road through the quest can only come
 * from a fault - a bug, or a damaged store - and the walk refuses it rather than guess, because a guess could
 * stand the quest at a node whose reward was collected already. Which ending of a dialogue led where is the
 * house's to check as it decides; the walk takes the move it was given.
 */
fun Quest.walk(progress: List<QuestProgress>): QuestWalk {
    var at: QuestNode? = start()
    val done = mutableListOf<NodeId>()
    val lost = mutableListOf<NodeId>()
    var ticked = setOf<ObjectiveId>()

    fun notARoad(reason: String): Nothing =
        throw IllegalArgumentException("what quest ${id.value} recorded follows no road through it: $reason")

    for (step in progress) {
        val here = at ?: notARoad("$step comes after its end")
        when (step) {
            is QuestProgress.Ticked -> {
                val which = step.objective.value
                if (step.node != here.id) notARoad("$which is ticked at ${step.node.value}, and it stands at ${here.id.value}")
                val checklist = (here as? ObjectiveNode)?.objectives ?: notARoad("$which is ticked at a node with no checklist")
                if (checklist.none { it.id == step.objective }) notARoad("${here.id.value} has no objective $which")
                if (step.objective in ticked) notARoad("$which is ticked twice")
                ticked = ticked + step.objective
            }
            is QuestProgress.Moved -> {
                if (step.from != here.id) notARoad("it moves past ${step.from.value}, and it stands at ${here.id.value}")
                if (here is ObjectiveNode && ticked != here.objectives.map { it.id }.toSet()) {
                    notARoad("it moves past ${here.id.value} with its checklist unticked")
                }
                val onto = step.onto
                if (onto == null && here.edges.isNotEmpty()) notARoad("it ends at ${here.id.value}, which leads on")
                if (onto != null && here.edges.none { it.to == onto }) {
                    notARoad("${here.id.value} has no edge to ${onto.value}")
                }
                done += here.id
                lost += cutOffBy(here.id, onto)
                at = onto?.let { node(it) }
                ticked = emptySet()
            }
        }
    }
    return QuestWalk(this, at?.id, done, lost, ticked)
}

/**
 * The nodes a move cuts off: those the node it left could still reach and the node it went to cannot, in the
 * order the quest lists them. A node lost before was cut off from where the quest then stood, and so from
 * everything after, which is why no node is lost twice.
 */
fun Quest.cutOffBy(from: NodeId, onto: NodeId?): List<NodeId> {
    val before = reachableFrom(from) - from
    val after = onto?.let(::reachableFrom).orEmpty()
    return nodes.map { it.id }.filter { it in before && it !in after }
}

/**
 * How far down each node stands: the longest road to it from the start, so every edge leads down the map and a
 * node shown ahead stands as far down as it really is, the unknown above it left blank.
 */
fun Quest.rows(): Map<NodeId, Int> {
    val rows = mutableMapOf(start().id to 0)
    val waiting = nodes.associate { node -> node.id to nodes.count { other -> other.edges.any { it.to == node.id } } }
        .toMutableMap()
    val ready = ArrayDeque(listOf(start().id))
    while (ready.isNotEmpty()) {
        val from = ready.removeFirst()
        for (edge in node(from)!!.edges) {
            rows[edge.to] = maxOf(rows[edge.to] ?: 0, rows.getValue(from) + 1)
            waiting[edge.to] = waiting.getValue(edge.to) - 1
            if (waiting.getValue(edge.to) == 0) ready += edge.to
        }
    }
    return rows
}

private fun Quest.reachableFrom(from: NodeId): Set<NodeId> {
    val reached = mutableSetOf<NodeId>()
    val next = ArrayDeque(listOf(from))
    while (next.isNotEmpty()) {
        val id = next.removeFirst()
        if (reached.add(id)) node(id)!!.edges.forEach { next += it.to }
    }
    return reached
}
