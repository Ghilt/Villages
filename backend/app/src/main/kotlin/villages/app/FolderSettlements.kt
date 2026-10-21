package villages.app

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import villages.application.settlements.SettlementBuilding
import villages.application.settlements.SettlementKind
import villages.application.settlements.SettlementSite
import villages.application.settlements.SettlementSites
import villages.domain.Location
import villages.domain.StructureType
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.FileTime
import java.util.concurrent.ConcurrentHashMap
import kotlin.io.path.getLastModifiedTime
import kotlin.io.path.isRegularFile

/**
 * The settlement sites port over the folder `world:settlements` files them in, `world/ground/`, beside each master's
 * ground map: a `settlements.json`, read the first time a master's are asked for and kept until it is written again.
 * A name that is not one of the folder's own masters has none and is never made into a path, as for the ground. The
 * shape is a contract, held by `contracts/fixtures/settlements.json`, and a site this cannot read is left out rather
 * than the file refused: a world with one settlement fewer still opens. See decision record 0114.
 */
class FolderSettlements(private val masters: Path) : SettlementSites {
    private class Read(val at: FileTime, val sites: List<SettlementSite>)

    private val read = ConcurrentHashMap<String, Read>()

    override fun of(master: String): List<SettlementSite>? {
        val file = ownFolder(masters, master)?.resolve("settlements.json") ?: return null
        if (!file.isRegularFile()) {
            return null
        }
        val at = file.getLastModifiedTime()
        return read.compute(master) { _, was -> if (was?.at == at) was else Read(at, parse(Files.readString(file))) }?.sites
    }

    companion object {
        private val json = JsonMapper.builder().build()

        /** A master's sites from its `settlements.json`. */
        fun parse(text: String): List<SettlementSite> {
            val sites = json.readTree(text)["sites"]
            return if (sites != null && sites.isArray) sites.values().mapNotNull(::siteOf) else emptyList()
        }

        private fun siteOf(node: JsonNode): SettlementSite? {
            val id = node.text("id")
            val type = node.text("type")?.let(SettlementKind::of)
            val level = node["level"]?.takeIf { it.isInt }?.asInt()
            val name = node.text("name")
            val lon = node["at"]?.get(0)?.takeIf { it.isNumber }?.asDouble()
            val lat = node["at"]?.get(1)?.takeIf { it.isNumber }?.asDouble()
            if (id == null || type == null || level == null || name == null || lon == null || lat == null) {
                return null
            }
            if (level !in 1..3 || lon !in -180.0..180.0 || lat !in -90.0..90.0) {
                return null
            }
            val radius = node["radius"]?.takeIf { it.isNumber }?.asDouble() ?: 0.0
            val buildings = node["buildings"]?.takeIf { it.isArray }?.values()?.mapNotNull(::buildingOf) ?: emptyList()
            return SettlementSite(id, type, level, name, Location(lat, lon), node.text("by"), radius, buildings)
        }

        /** A building of a site; one that cannot be read is left out, as a site is. */
        private fun buildingOf(node: JsonNode): SettlementBuilding? {
            val type = node.text("type")?.let { runCatching { StructureType(it) }.getOrNull() } ?: return null
            val level = node["level"]?.takeIf { it.isInt }?.asInt()?.takeIf { it in 1..3 } ?: return null
            val lon = node["at"]?.get(0)?.takeIf { it.isNumber }?.asDouble()?.takeIf { it in -180.0..180.0 } ?: return null
            val lat = node["at"]?.get(1)?.takeIf { it.isNumber }?.asDouble()?.takeIf { it in -90.0..90.0 } ?: return null
            return SettlementBuilding(type, level, Location(lat, lon))
        }

        private fun JsonNode.text(field: String): String? = get(field)?.takeIf { it.isString }?.asString()
    }
}
