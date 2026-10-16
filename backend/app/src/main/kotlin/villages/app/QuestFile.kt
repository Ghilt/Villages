package villages.app

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import villages.application.QuestTemplate
import villages.application.QuestTemplate.DialogueAt
import villages.application.QuestTemplate.NodeTemplate
import villages.application.QuestTemplate.ObjectivesAt
import villages.application.QuestTemplate.RewardAt
import villages.domain.Edge
import villages.domain.Effect
import villages.domain.LineId
import villages.domain.NodeId
import villages.domain.Objective
import villages.domain.ObjectiveId
import villages.domain.Resource
import villages.domain.StructureType
import villages.domain.Where

/**
 * A quest file, `world/catalogues/quests/<name>.json`, read into the template a quest is offered from: strict, so a
 * field it cannot read refuses the whole file, naming where. Nodes by their ids, the first the one it starts at: a
 * node offers a `dialogue` of `dialogues/` by its name, holds `objectives` - each `delivers` or `pledges` a resource,
 * by its name on the wire, or `holds` a type of structure, `on` an `island` or anywhere - or `gives` a reward; it may be
 * `hidden` or `shownAhead`; and it leads `then` to a node, or, after a dialogue, to each node by the endings that lead
 * there. The shape is a contract, held by `contracts/fixtures/quest.json`. See decision record 0097.
 */
object QuestFile {
    private val json = JsonMapper.builder().build()

    private val RESOURCES = Resource.entries.associateBy { wireName(it.name) }

    /** The quest [name] says, `abbot` for `quests/abbot.json`, for what a refusal names. */
    fun parse(text: String, name: String = "a quest"): QuestTemplate {
        fun refuse(at: String): Nothing =
            throw IllegalArgumentException("world/catalogues/quests/$name.json: no $at the server can read")
        val root = json.readTree(text)
        val nodes = root["nodes"]?.takeIf { it.isObject } ?: refuse("nodes")
        return QuestTemplate(
            title = root["title"]?.takeIf { it.isString }?.asString() ?: refuse("title"),
            scene = root["scene"]?.let { scene -> scene.takeIf { it.isString }?.asString() ?: refuse("scene") },
            shownFromTheStart = flag(root, "shownFromTheStart", "shownFromTheStart", ::refuse),
            nodes = nodes.properties().filter { !it.key.startsWith("$") }.map { (id, node) -> nodeOf(id, node, ::refuse) },
        )
    }

    private fun nodeOf(id: String, node: JsonNode, refuse: (String) -> Nothing): NodeTemplate {
        val at = "nodes.$id"
        if (!node.isObject) refuse(at)
        val title = node["title"]?.takeIf { it.isString }?.asString() ?: refuse("$at.title")
        val hidden = flag(node, "hidden", "$at.hidden", refuse)
        val shownAhead = flag(node, "shownAhead", "$at.shownAhead", refuse)
        val edges = when (val then = node["then"]) {
            null -> emptyList()
            else -> when {
                then.isString -> listOf(Edge(NodeId(then.asString())))
                then.isObject -> then.properties().map { (to, endings) ->
                    if (!endings.isArray) refuse("$at.then.$to")
                    Edge(NodeId(to), endings.values().map { LineId(it.takeIf { one -> one.isString }?.asString() ?: refuse("$at.then.$to")) }.toSet())
                }
                else -> refuse("$at.then")
            }
        }
        val dialogue = node["dialogue"]
        val objectives = node["objectives"]
        val gives = node["gives"]
        return when {
            dialogue != null && objectives == null && gives == null ->
                DialogueAt(id, title, dialogue.takeIf { it.isString }?.asString() ?: refuse("$at.dialogue"), edges, hidden, shownAhead)
            objectives != null && dialogue == null && gives == null && objectives.isObject -> ObjectivesAt(
                id, title,
                objectives.properties().filter { !it.key.startsWith("$") }.map { (key, objective) -> objectiveOf(key, objective, "$at.objectives.$key", refuse) },
                edges, hidden, shownAhead,
            )
            gives != null && dialogue == null && objectives == null && gives.isObject -> RewardAt(
                id, title,
                gives.properties().map { (resource, amount) ->
                    Effect.Grant(
                        RESOURCES[resource] ?: refuse("$at.gives.$resource"),
                        amount.takeIf { it.isIntegralNumber }?.asLong() ?: refuse("$at.gives.$resource"),
                    )
                },
                edges, hidden, shownAhead,
            )
            else -> refuse("$at.dialogue, objectives or gives, and only one,")
        }
    }

    private fun objectiveOf(id: String, node: JsonNode, at: String, refuse: (String) -> Nothing): Objective {
        if (!node.isObject) refuse(at)
        fun resource(field: String) = node[field]?.takeIf { it.isString }?.asString()?.let(RESOURCES::get) ?: refuse("$at.$field")
        fun amount() = node["amount"]?.takeIf { it.isIntegralNumber }?.asLong() ?: refuse("$at.amount")
        return when {
            node.has("delivers") -> Objective.Deliver(ObjectiveId(id), resource("delivers"), amount())
            node.has("pledges") -> Objective.Pledge(
                ObjectiveId(id), resource("pledges"), amount(),
                node["months"]?.takeIf { it.isIntegralNumber }?.asInt() ?: refuse("$at.months"),
            )
            node.has("holds") -> Objective.Hold(
                ObjectiveId(id),
                StructureType(node["holds"]?.takeIf { it.isString }?.asString() ?: refuse("$at.holds")),
                when (val on = node["on"]) {
                    null -> Where.Anywhere
                    else -> if (on.isString && on.asString() == "island") Where.Island else refuse("$at.on")
                },
            )
            else -> refuse("$at.delivers, pledges or holds")
        }
    }

    private fun flag(node: JsonNode, field: String, at: String, refuse: (String) -> Nothing): Boolean {
        val value = node[field] ?: return false
        return if (value.isBoolean) value.booleanValue() else refuse(at)
    }

    private fun wireName(constant: String): String =
        constant.lowercase().split('_').mapIndexed { at, word -> if (at == 0) word else word.replaceFirstChar(Char::uppercase) }
            .joinToString("")
}
