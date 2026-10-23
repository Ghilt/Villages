package villages.gateway

import villages.application.QuestEnding
import villages.application.QuestRow
import villages.domain.ChallengeNode
import villages.domain.DialogueNode
import villages.domain.Effect
import villages.domain.NodeState
import villages.domain.EdgeState
import villages.domain.Objective
import villages.domain.ObjectiveNode
import villages.domain.QuestNode
import villages.domain.QuestWalk
import villages.domain.RewardNode
import villages.domain.Where
import villages.domain.rows
import villages.domain.walk
import villages.protocol.EndingView
import villages.protocol.ObjectiveView
import villages.protocol.OpponentView
import villages.protocol.QuestChallengeView
import villages.protocol.QuestEdgeView
import villages.protocol.QuestNodeView
import villages.protocol.QuestView

/**
 * A quest as its player may know it, walked from what the house recorded: the nodes the walk draws and the edges
 * touching them, a question mark as no more than its place, and nothing of a node that is not drawn. The walk is the
 * decider's own, so the page and the house's rules cannot disagree. See decision record 0096.
 */
internal fun QuestRow.toView(): QuestView {
    val walk = quest.walk(progress)
    val rows = quest.rows()
    val drawn = quest.nodes.filter { walk.isDrawn(it.id) }
    val edges = quest.nodes.flatMap { from ->
        from.edges.mapNotNull { edge ->
            val fromDrawn = walk.isDrawn(from.id)
            val toDrawn = walk.isDrawn(edge.to)
            if (!fromDrawn && !toDrawn) {
                null
            } else {
                QuestEdgeView(
                    from = from.id.value.takeIf { fromDrawn },
                    to = edge.to.value.takeIf { toDrawn },
                    state = walk.stateOf(from.id, edge).toWire(),
                    verdict = edge.verdict?.name?.lowercase()?.takeIf { fromDrawn && !walk.isQuestionMark(from.id) },
                )
            }
        }
    }
    return QuestView(
        id = quest.id.value.toString(),
        revision = revision,
        title = quest.title,
        scene = quest.scene,
        nodes = drawn.map { it.toView(walk, rows.getValue(it.id)) },
        edges = edges,
        ending = when (val stands = ending) {
            QuestEnding.Open -> EndingView.Open
            QuestEnding.Completed -> EndingView.Completed
            is QuestEnding.Lost -> EndingView.Lost(stands.because.toView())
        },
    )
}

private fun QuestNode.toView(walk: QuestWalk, row: Int): QuestNodeView {
    val state = walk.stateOf(id).toWire()
    if (walk.isQuestionMark(id)) return QuestNodeView(id.value, row, state)
    val base = QuestNodeView(id.value, row, state, title = title)
    return when (this) {
        is DialogueNode -> base.copy(kind = "dialogue", dialogueId = dialogue.id.value.toString())
        is ObjectiveNode -> base.copy(
            kind = "checklist",
            objectives = objectives.map { it.toView(met = (walk.at == id && it.id in walk.ticked) || walk.stateOf(id) == NodeState.DONE) },
        )
        is RewardNode -> base.copy(kind = "reward", gives = gives.map(Effect::toView))
        is ChallengeNode -> base.copy(
            kind = "challenge",
            challenge = QuestChallengeView(challenge.kind, OpponentView(challenge.against.name, challenge.against.colour)),
        )
    }
}

private fun Objective.toView(met: Boolean): ObjectiveView = when (this) {
    is Objective.Deliver -> ObjectiveView.Deliver(id.value, met, resource.toWire(), amount)
    is Objective.Pledge -> ObjectiveView.Pledge(id.value, met, resource.toWire(), amount, months)
    is Objective.Hold -> ObjectiveView.Hold(
        id.value,
        met,
        structureType.name,
        when (where) {
            Where.Anywhere -> "anywhere"
            Where.Island -> "island"
        },
    )
}

private fun NodeState.toWire(): String = when (this) {
    NodeState.DONE -> "done"
    NodeState.CURRENT -> "current"
    NodeState.AHEAD -> "ahead"
    NodeState.LOST -> "lost"
}

private fun EdgeState.toWire(): String = when (this) {
    EdgeState.WALKED -> "walked"
    EdgeState.AHEAD -> "ahead"
    EdgeState.LOST -> "lost"
}
