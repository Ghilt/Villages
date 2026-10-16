package villages.app

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import villages.domain.LevelSpec
import villages.domain.Resource
import villages.domain.SeenBy
import villages.domain.Significance
import villages.domain.SlotSpec
import villages.domain.Stat
import villages.domain.StructureCatalogue
import villages.domain.StructureSpec
import villages.domain.StructureType
import villages.domain.Takes

/**
 * `world/catalogues/structures.json` read into the catalogue the rules decide by. Strict where the names reader is forgiving:
 * a field this cannot read refuses the whole file, saying which type and which field, because a structure raised with
 * half its numbers is worse than a server that will not start. The words, the sizes on the map and the zones are the
 * page's and are passed over. The shape is a contract, held by `contracts/fixtures/structures.json`. See 0093.
 */
object StructureCatalogueFile {
    private val json = JsonMapper.builder().build()

    /** The resources and the stats by the names the wire gives them: `naturalDomain`, `piety`. */
    private val RESOURCES = Resource.entries.associateBy { wireName(it.name) }
    private val STATS = Stat.entries.associateBy { wireName(it.name) }

    fun parse(text: String): StructureCatalogue {
        val types = json.readTree(text)["types"]?.takeIf { it.isObject } ?: refuse("the file", "types")
        return StructureCatalogue(types.properties().associate { (name, type) -> StructureType(name) to specOf(name, type) })
    }

    private fun specOf(type: String, node: JsonNode): StructureSpec {
        val significance = numbers(node, type, "significance")
        val sight = numbers(node, type, "sightKm")
        if (sight.size != significance.size) refuse(type, "sightKm")
        val yields = node["yields"]?.takeIf { it.isObject } ?: refuse(type, "yields")
        val byResource = yields.properties().associate { (name, _) ->
            val resource = RESOURCES[name] ?: refuse(type, "yields.$name")
            val each = numbers(yields, type, name)
            if (each.size != significance.size) refuse(type, "yields.$name")
            resource to each
        }
        val levels = significance.indices.map { at ->
            LevelSpec(Significance(significance[at]), sight[at], byResource.mapValues { (_, each) -> each[at] })
        }
        val slots = node["slots"]?.takeIf { it.isArray } ?: refuse(type, "slots")
        return StructureSpec(levels, slots.values().map { slotOf(type, it) })
    }

    private fun slotOf(type: String, node: JsonNode): SlotSpec {
        val name = node["name"]?.takeIf { it.isString }?.asString() ?: refuse(type, "slots.name")
        val at = "slots.$name"
        return SlotSpec(
            name = name,
            takes = enumOf<Takes>(node["takes"]) ?: refuse(type, "$at.takes"),
            places = numbers(node, type, "places").map(Double::toInt),
            seenBy = enumOf<SeenBy>(node["seenBy"]) ?: refuse(type, "$at.seenBy"),
            needed = flag(node, type, "$at.needed", "needed"),
            adds = node["adds"]?.properties()?.associate { (resource, amount) ->
                val each = amount.takeIf { it.isNumber }?.asDouble() ?: refuse(type, "$at.adds.$resource")
                (RESOURCES[resource] ?: refuse(type, "$at.adds.$resource")) to each
            } ?: emptyMap(),
            scales = node["scales"]?.let { stat -> stat.takeIf { it.isString }?.asString()?.let(STATS::get) ?: refuse(type, "$at.scales") },
            bringsItsOwn = flag(node, type, "$at.bringsItsOwn", "bringsItsOwn"),
        )
    }

    private fun numbers(node: JsonNode, type: String, field: String): List<Double> {
        val list = node[field]?.takeIf { it.isArray && it.size() > 0 } ?: refuse(type, field)
        return list.values().map { if (it.isNumber) it.asDouble() else refuse(type, field) }
    }

    /** A field that is true or false, and false when it is not there. */
    private fun flag(node: JsonNode, type: String, at: String, field: String): Boolean {
        val value = node[field] ?: return false
        return if (value.isBoolean) value.booleanValue() else refuse(type, at)
    }

    private inline fun <reified E : Enum<E>> enumOf(node: JsonNode?): E? =
        node?.takeIf { it.isString }?.asString()?.let { name -> enumValues<E>().firstOrNull { wireName(it.name) == name } }

    /** `NATURAL_DOMAIN` as the wire says it, `naturalDomain`. */
    private fun wireName(constant: String): String =
        constant.lowercase().split('_').mapIndexed { at, word -> if (at == 0) word else word.replaceFirstChar(Char::uppercase) }
            .joinToString("")

    private fun refuse(type: String, field: String): Nothing =
        throw IllegalArgumentException("world/catalogues/structures.json: $type has no $field the server can read")
}
