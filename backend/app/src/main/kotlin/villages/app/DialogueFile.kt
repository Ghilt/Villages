package villages.app

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import villages.application.DialogueTemplate
import villages.application.DialogueTemplate.LineTemplate
import villages.application.DialogueTemplate.ShowsWhat
import villages.application.DialogueTemplate.SpeakerTemplate
import villages.application.DialogueTemplate.Who
import villages.domain.Effect
import villages.domain.Impact
import villages.domain.LineId
import villages.domain.Resource
import villages.domain.RevealImpact
import villages.domain.Then

/**
 * A dialogue file, `world/catalogues/dialogues/<name>.json`, read into the template a dialogue is offered from: strict,
 * so a field it cannot read refuses the whole file, naming where. Speakers and lines by their ids; a speaker `is` the
 * house's `keyFigure` or has a `name`; a line is said `by` a speaker, `says` its words, `grants` and `spends` resources
 * by their names on the wire, `reveals` what it does - `hidden`, or a list of `{ "wealth": -40 }` - `shows` the `seat`,
 * the `house` or the `keyFigure`, and leads `then` to a line, to a dialogue choice of lines, or, with none, ends. The
 * shape is a contract, held by `contracts/fixtures/dialogue.json`. See decision record 0097.
 */
object DialogueFile {
    private val json = JsonMapper.builder().build()

    private val RESOURCES = Resource.entries.associateBy { wireName(it.name) }
    private val SHOWS = mapOf("seat" to ShowsWhat.SEAT, "house" to ShowsWhat.HOUSE, "keyFigure" to ShowsWhat.KEY_FIGURE)

    /** The dialogue [name] says, `letter` for `dialogues/letter.json`, for what a refusal names. */
    fun parse(text: String, name: String = "a dialogue"): DialogueTemplate {
        val file = "world/catalogues/dialogues/$name.json"
        fun refuse(at: String): Nothing = throw IllegalArgumentException("$file: no $at the server can read")
        val root = json.readTree(text)
        val speakers = root["speakers"]?.takeIf { it.isObject } ?: refuse("speakers")
        val lines = root["lines"]?.takeIf { it.isObject } ?: refuse("lines")
        return DialogueTemplate(
            title = root["title"]?.takeIf { it.isString }?.asString() ?: refuse("title"),
            scene = root["scene"]?.let { scene -> scene.takeIf { it.isString }?.asString() ?: refuse("scene") },
            speakers = fields(speakers).map { (id, node) ->
                val at = "speakers.$id"
                val party = node["party"]?.takeIf { it.isIntegralNumber }?.asInt() ?: refuse("$at.party")
                val who = when {
                    node["is"]?.takeIf { it.isString }?.asString() == "keyFigure" -> Who.KeyFigure
                    node["name"]?.isString == true -> Who.Named(node["name"].asString(), node["portrait"]?.takeIf { it.isString }?.asString())
                    else -> refuse("$at.name or is")
                }
                SpeakerTemplate(id, party, who)
            },
            lines = fields(lines).map { (id, node) -> lineOf(id, node, ::refuse) },
        )
    }

    private fun lineOf(id: String, node: JsonNode, refuse: (String) -> Nothing): LineTemplate {
        val at = "lines.$id"
        fun amounts(field: String): List<Pair<Resource, Long>> = node[field]?.let { each ->
            if (!each.isObject) refuse("$at.$field")
            each.properties().map { (resource, amount) ->
                (RESOURCES[resource] ?: refuse("$at.$field.$resource")) to
                    (amount.takeIf { it.isIntegralNumber }?.asLong() ?: refuse("$at.$field.$resource"))
            }
        }.orEmpty()
        val then = when (val next = node["then"]) {
            null -> Then.End
            else -> when {
                next.isString -> Then.Say(LineId(next.asString()))
                next.isArray -> Then.DialogueChoice(next.values().map { LineId(it.takeIf { one -> one.isString }?.asString() ?: refuse("$at.then")) })
                else -> refuse("$at.then")
            }
        }
        val reveals = node["reveals"]?.let { reveal ->
            when {
                reveal.isString && reveal.asString() == "hidden" -> RevealImpact.Hidden
                reveal.isArray -> RevealImpact.Shown(
                    reveal.values().flatMap { impact ->
                        if (!impact.isObject) refuse("$at.reveals")
                        impact.properties().map { (resource, amount) ->
                            Impact(RESOURCES[resource] ?: refuse("$at.reveals.$resource"), amount.takeIf { it.isIntegralNumber }?.asLong() ?: refuse("$at.reveals"))
                        }
                    },
                )
                else -> refuse("$at.reveals")
            }
        }
        return LineTemplate(
            id = id,
            by = node["by"]?.takeIf { it.isString }?.asString() ?: refuse("$at.by"),
            says = node["says"]?.takeIf { it.isString }?.asString() ?: refuse("$at.says"),
            effects = amounts("spends").map { (resource, amount) -> Effect.Spend(resource, amount) } +
                amounts("grants").map { (resource, amount) -> Effect.Grant(resource, amount) },
            then = then,
            revealImpact = reveals,
            shows = node["shows"]?.let { shows -> SHOWS[shows.asString()] ?: refuse("$at.shows") },
        )
    }

    private fun fields(node: JsonNode): List<Pair<String, JsonNode>> =
        node.properties().filter { !it.key.startsWith("$") }.map { it.key to it.value }

    private fun wireName(constant: String): String =
        constant.lowercase().split('_').mapIndexed { at, word -> if (at == 0) word else word.replaceFirstChar(Char::uppercase) }
            .joinToString("")
}
