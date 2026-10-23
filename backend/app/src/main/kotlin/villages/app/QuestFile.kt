package villages.app

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import villages.application.QuestTemplate
import villages.application.QuestTemplate.ChallengeAt
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
import villages.domain.Opponent
import villages.domain.QuestChallenge
import villages.domain.Resource
import villages.domain.StructureType
import villages.domain.Verdict
import villages.domain.Where

/**
 * A quest file, `world/catalogues/quests/<name>.json`, read into the template a quest is offered from: strict, so a
 * field it cannot read refuses the whole file, naming where. Nodes by their ids, the first the one it starts at: a
 * node offers a `dialogue` of `dialogues/` by its name, holds `objectives` - each `delivers` or `pledges` a resource,
 * by its name on the wire, or `holds` a type of structure, `on` an `island` or anywhere - `gives` a reward, or puts a
 * `challenge`: its `kind`, who stands `against` the house, a `name` and a `colour`, and the `slices` they bring. It may
 * be `hidden` or `shownAhead`; and it leads `then` to a node, or, after a dialogue, to each node by the endings that
 * lead there, or after a challenge to each node by `won` or `lost`. The shape is a contract, held by
 * `contracts/fixtures/quest.json`. See decision records 0097 and 0107, amended.
 */
object QuestFile {
    private val json = JsonMapper.builder().build()

    private val RESOURCES = Resource.entries.associateBy { wireName(it.name) }

    private val VERDICTS = Verdict.entries.associateBy { it.name.lowercase() }

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
        val dialogue = node["dialogue"]
        val objectives = node["objectives"]
        val gives = node["gives"]
        val challenge = node["challenge"]
        if (listOfNotNull(dialogue, objectives, gives, challenge).size != 1) refuse("$at.dialogue, objectives, gives or challenge, and only one,")
        val edges = edgesOf(node["then"], at, byVerdict = challenge != null, refuse)
        return when {
            dialogue != null ->
                DialogueAt(id, title, dialogue.takeIf { it.isString }?.asString() ?: refuse("$at.dialogue"), edges, hidden, shownAhead)
            objectives != null -> ObjectivesAt(
                id, title,
                (objectives.takeIf { it.isObject } ?: refuse("$at.objectives")).properties().filter { !it.key.startsWith("$") }
                    .map { (key, objective) -> objectiveOf(key, objective, "$at.objectives.$key", refuse) },
                edges, hidden, shownAhead,
            )
            gives != null -> RewardAt(
                id, title,
                (gives.takeIf { it.isObject } ?: refuse("$at.gives")).properties().map { (resource, amount) ->
                    Effect.Grant(
                        RESOURCES[resource] ?: refuse("$at.gives.$resource"),
                        amount.takeIf { it.isIntegralNumber }?.asLong() ?: refuse("$at.gives.$resource"),
                    )
                },
                edges, hidden, shownAhead,
            )
            else -> ChallengeAt(id, title, challengeOf(challenge!!, "$at.challenge", refuse), edges, hidden, shownAhead)
        }
    }

    /**
     * Where a node leads: to one node by its id, or to each node by what leads there - after a dialogue the lines that
     * end it, after a challenge [byVerdict] `won` or `lost`.
     */
    private fun edgesOf(then: JsonNode?, at: String, byVerdict: Boolean, refuse: (String) -> Nothing): List<Edge> = when {
        then == null -> emptyList()
        then.isString -> listOf(Edge(NodeId(then.asString())))
        then.isObject -> then.properties().map { (to, leading) ->
            if (!leading.isArray) refuse("$at.then.$to")
            val names = leading.values().map { it.takeIf { one -> one.isString }?.asString() ?: refuse("$at.then.$to") }
            if (byVerdict) {
                Edge(NodeId(to), verdict = names.singleOrNull()?.let(VERDICTS::get) ?: refuse("$at.then.$to won or lost"))
            } else {
                Edge(NodeId(to), names.map(::LineId).toSet())
            }
        }
        else -> refuse("$at.then")
    }

    private fun challengeOf(node: JsonNode, at: String, refuse: (String) -> Nothing): QuestChallenge {
        if (!node.isObject) refuse(at)
        val against = node["against"]?.takeIf { it.isObject } ?: refuse("$at.against")
        return QuestChallenge(
            kind = node["kind"]?.takeIf { it.isString }?.asString() ?: refuse("$at.kind"),
            against = Opponent(
                against["name"]?.takeIf { it.isString }?.asString() ?: refuse("$at.against.name"),
                against["colour"]?.takeIf { it.isString }?.asString() ?: refuse("$at.against.colour"),
            ),
            slices = SliceText.slicesOf(node["slices"], "$at.slices", refuse),
        )
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
