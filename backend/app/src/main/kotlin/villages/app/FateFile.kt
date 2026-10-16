package villages.app

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import villages.application.fate.FateCatalogue
import villages.application.fate.FateCatalogue.ActionSpec
import villages.application.fate.FateCatalogue.Deals
import villages.application.fate.FateCatalogue.PoolSpec
import villages.domain.Rarity
import villages.domain.Resource

/**
 * `world/catalogues/fate.json` read into the pools and actions the fate engine deals from: strict, so a field it
 * cannot read refuses the whole file, naming where. A field beginning `$` says what the ones beside it are, and is
 * passed over. An action is a grant, naming the resource it `grants`, or `gossip`. The shape is a contract, held by
 * `contracts/fixtures/fate.json`, which the world package's `parseFate` reads too. See decision record 0097.
 */
object FateFile {
    private val json = JsonMapper.builder().build()

    /** The resources by the names the wire gives them: `naturalDomain`, `piety`. */
    private val RESOURCES = Resource.entries.associateBy { wireName(it.name) }

    fun parse(text: String): FateCatalogue {
        val root = json.readTree(text)
        val pools = root["pools"]?.takeIf { it.isObject } ?: refuse("pools")
        val actions = root["actions"]?.takeIf { it.isObject } ?: refuse("actions")
        return FateCatalogue(
            pools = fields(pools).map { (name, keys) -> PoolSpec(name, words(keys, "pools.$name")) },
            actions = fields(actions).map { (id, action) -> actionOf(id, action) },
        )
    }

    private fun actionOf(id: String, node: JsonNode): ActionSpec {
        val at = "actions.$id"
        if (!node.isObject) refuse(at)
        val rarity = node["rarity"]?.takeIf { it.isString }?.asString()
            ?.let { name -> Rarity.entries.firstOrNull { it.name.lowercase() == name } } ?: refuse("$at.rarity")
        val grants = node["grants"]
        val gossip = node["gossip"]
        val deals = when {
            grants != null && gossip == null ->
                Deals.Grant(grants.takeIf { it.isString }?.asString()?.let(RESOURCES::get) ?: refuse("$at.grants"))
            gossip != null && grants == null && gossip.isObject -> Deals.Gossip(
                spreads = gossip["spreads"]?.takeIf { it.isIntegralNumber }?.asLong() ?: refuse("$at.gossip.spreads"),
                heardOfKm = gossip["heardOfKm"]?.takeIf { it.isNumber }?.asDouble() ?: refuse("$at.gossip.heardOfKm"),
                rumours = words(gossip["rumours"], "$at.gossip.rumours").ifEmpty { refuse("$at.gossip.rumours") },
            )
            else -> refuse("$at.grants or gossip, and only one,")
        }
        return ActionSpec(
            id = id,
            rarity = rarity,
            pools = words(node["pools"], "$at.pools"),
            label = word(node, "label", at),
            detail = word(node, "detail", at),
            deals = deals,
        )
    }

    /** An object's fields, leaving out what begins `$`, which says what the rest are. */
    private fun fields(node: JsonNode): List<Pair<String, JsonNode>> =
        node.properties().filter { !it.key.startsWith("$") }.map { it.key to it.value }

    private fun word(node: JsonNode, field: String, at: String): String =
        node[field]?.takeIf { it.isString }?.asString()?.takeIf { it.isNotBlank() } ?: refuse("$at.$field")

    private fun words(node: JsonNode?, at: String): List<String> {
        val list = node?.takeIf { it.isArray } ?: refuse(at)
        return list.values().map { it.takeIf { word -> word.isString }?.asString() ?: refuse(at) }
    }

    /** `NATURAL_DOMAIN` as the wire says it, `naturalDomain`. */
    private fun wireName(constant: String): String =
        constant.lowercase().split('_').mapIndexed { at, word -> if (at == 0) word else word.replaceFirstChar(Char::uppercase) }
            .joinToString("")

    private fun refuse(at: String): Nothing =
        throw IllegalArgumentException("world/catalogues/fate.json: no $at the server can read")
}
