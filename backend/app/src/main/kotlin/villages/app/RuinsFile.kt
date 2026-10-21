package villages.app

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import villages.application.bots.RuinReach

/**
 * `world/ruins.json` read for how far each town's ruins reach: its `size` and the people of every town it lists,
 * and nothing of how a ruin is laid out, which is the page's (0104). Strict, so a number it cannot read refuses the
 * whole file, naming where; the world package's `parseRuins` reads the same file for the page. See decision record
 * 0108.
 */
object RuinsFile {
    private val json = JsonMapper.builder().build()

    fun parse(text: String): RuinReach {
        val root = json.readTree(text)
        val size = root["size"]?.takeIf { it.isObject } ?: refuse("size")
        val towns = root["towns"]?.takeIf { it.isObject } ?: refuse("towns")
        return RuinReach(
            perRootThousand = number(size, "perRootThousand"),
            least = number(size, "least"),
            most = number(size, "most"),
            ring = number(size, "ring"),
            unlisted = number(size, "unlisted").toLong(),
            people = towns.properties().associate { (id, row) ->
                id to (row[0]?.takeIf { it.isIntegralNumber }?.asLong() ?: refuse("towns.$id"))
            },
        )
    }

    private fun number(group: JsonNode, name: String): Double =
        group[name]?.takeIf { it.isNumber }?.asDouble() ?: refuse("size.$name")

    private fun refuse(at: String): Nothing =
        throw IllegalArgumentException("world/ruins.json: no $at the server can read")
}
