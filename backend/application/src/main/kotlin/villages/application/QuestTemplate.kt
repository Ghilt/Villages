package villages.application

import villages.domain.DialogueId
import villages.domain.DialogueNode
import villages.domain.Edge
import villages.domain.Effect
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.NodeId
import villages.domain.Objective
import villages.domain.ObjectiveNode
import villages.domain.Quest
import villages.domain.QuestId
import villages.domain.RewardNode
import villages.domain.StructureCatalogue
import villages.domain.ofNode
import java.util.UUID

/**
 * A quest as `world/catalogues/quests/<name>.json` writes it: everything a [Quest] is but its id, its dialogue nodes
 * naming dialogues in `dialogues/` rather than holding them, so one written by hand reads and a dialogue is written
 * once. Made into the quest when it is offered, each dialogue offered under the id worked out from the quest and its
 * node. See decision record 0097.
 */
data class QuestTemplate(
    val title: String,
    val scene: String?,
    val shownFromTheStart: Boolean,
    val nodes: List<NodeTemplate>,
) {
    /** A node: its id, its title, whether it is a question mark until reached or shown ahead, and where it leads. */
    sealed interface NodeTemplate {
        val id: String
        val title: String
        val hidden: Boolean
        val shownAhead: Boolean
        val edges: List<Edge>
    }

    /** A node that offers a dialogue of the shelf's, by its name, `abbot-at-the-gate`. */
    data class DialogueAt(
        override val id: String,
        override val title: String,
        val dialogue: String,
        override val edges: List<Edge>,
        override val hidden: Boolean,
        override val shownAhead: Boolean,
    ) : NodeTemplate

    data class ObjectivesAt(
        override val id: String,
        override val title: String,
        val objectives: List<Objective>,
        override val edges: List<Edge>,
        override val hidden: Boolean,
        override val shownAhead: Boolean,
    ) : NodeTemplate

    data class RewardAt(
        override val id: String,
        override val title: String,
        val gives: List<Effect.Grant>,
        override val edges: List<Edge>,
        override val hidden: Boolean,
        override val shownAhead: Boolean,
    ) : NodeTemplate

    /**
     * This quest, offered to [house] under [id], each dialogue node's dialogue taken from [dialogues] and filled for the
     * house: the quest the domain checks when it is made, refusing it as `InvalidQuest` when it does not hold together.
     */
    fun offered(id: QuestId, house: HouseId, dialogues: Map<String, DialogueTemplate>): Quest = Quest(
        id = id,
        title = title,
        scene = scene,
        shownFromTheStart = shownFromTheStart,
        nodes = nodes.map { node ->
            val at = NodeId(node.id)
            when (node) {
                is DialogueAt -> DialogueNode(
                    at,
                    node.title,
                    (dialogues[node.dialogue] ?: throw HouseError.InvalidQuest("node ${node.id} offers ${node.dialogue}, a dialogue there is not"))
                        .offered(DialogueId.ofNode(id, at), DialogueTemplate.Filling(house, seat = null, figure = null)),
                    node.edges,
                    node.hidden,
                    node.shownAhead,
                )
                is ObjectivesAt -> ObjectiveNode(at, node.title, node.objectives, node.edges, node.hidden, node.shownAhead)
                is RewardAt -> RewardNode(at, node.title, node.gives, node.edges, node.hidden, node.shownAhead)
            }
        },
    )

    /**
     * Whether it holds together with the catalogues beside it, as the shelf asks before taking it on: every dialogue it
     * names is on the shelf and spoken by people of its own - a quest's dialogues are not spoken by the house's key
     * figure yet - every type of structure it asks to be held is in the catalogue, and, offered to a stand-in house, the
     * domain's own checks pass. Throws [CatalogueRefused] naming the file and why.
     */
    fun check(name: String, dialogues: Map<String, DialogueTemplate>, structures: StructureCatalogue): QuestTemplate {
        fun refuse(why: String): Nothing = throw CatalogueRefused("${Catalogues.QUESTS}/$name", why)
        for (node in nodes.filterIsInstance<DialogueAt>()) {
            val dialogue = dialogues[node.dialogue] ?: refuse("node ${node.id} offers ${node.dialogue}, which is not in dialogues/")
            if (dialogue.needsKeyFigure) refuse("node ${node.id} offers ${node.dialogue}, which the house's key figure speaks, and a quest's cannot yet")
        }
        nodes.filterIsInstance<ObjectivesAt>().flatMap { node -> node.objectives.filterIsInstance<Objective.Hold>().map { node to it } }
            .firstOrNull { (_, hold) -> structures.of(hold.structureType) == null }
            ?.let { (node, hold) -> refuse("node ${node.id} asks a ${hold.structureType.name} be held, a type the structures do not have") }
        try {
            offered(QuestId(UUID(0, 0)), HouseId(UUID(0, 1)), dialogues)
        } catch (wrong: HouseError) {
            refuse(wrong.message ?: "it does not hold together")
        }
        return this
    }
}
