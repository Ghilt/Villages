package villages.app

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import villages.application.fate.NameKind
import villages.application.fate.NamedRegion
import villages.application.fate.PlaceName
import villages.application.fate.PlaceNames
import villages.application.fate.PlaceNamesByMaster
import villages.application.fate.RegionKind
import villages.domain.Location
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.FileTime
import java.util.concurrent.ConcurrentHashMap
import kotlin.io.path.getLastModifiedTime
import kotlin.io.path.isRegularFile

/**
 * The names port over the folder `world:names` files the server's copy in, `world/ground/`, beside each master's
 * ground map: a `names.json`, every name carried into its world and every named region, and a `regions.bin`, which
 * region each square of its origin map is in and by. A master's are read the first time they are asked for and kept
 * until its `names.json` is written again, which it is last. A name that is not one of the folder's own masters has
 * none and is never made into a path, as for the ground. The shape is a contract, held by
 * `contracts/fixtures/names.json`, and what this cannot read in it is left out rather than refused: a server with
 * fewer names still rolls. See decision records 0087 and 0084.
 */
class FolderNames(private val masters: Path) : PlaceNamesByMaster {
    private class Read(val at: FileTime, val names: PlaceNames)

    private val read = ConcurrentHashMap<String, Read>()

    override fun of(master: String): PlaceNames? {
        val own = ownFolder(masters, master) ?: return null
        val file = own.resolve("names.json")
        if (!file.isRegularFile()) {
            return null
        }
        val at = file.getLastModifiedTime()
        val regions = own.resolve("regions.bin")
        return read.compute(master) { _, was ->
            if (was?.at == at) {
                was
            } else {
                Read(at, parse(Files.readString(file), regions.takeIf { it.isRegularFile() }?.let(Files::readAllBytes)))
            }
        }?.names
    }

    companion object {
        private val json = JsonMapper.builder().build()

        /** A master's names from its `names.json` and the bytes of its `regions.bin`, if it has one. */
        fun parse(text: String, regions: ByteArray?): PlaceNames {
            val file = json.readTree(text)
            val listed = file["regions"].list().mapNotNull(::regionOf)
            val columns = file["columns"]?.takeIf { it.isNumber }?.asInt() ?: 0
            val rows = file["rows"]?.takeIf { it.isNumber }?.asInt() ?: 0
            val squares = columns * rows
            // Two layers, the land and then the sea, a little-endian sixteen-bit number a square.
            val layers = if (regions != null && squares > 0 && regions.size == squares * 4) {
                ShortArray(squares * 2).also { ByteBuffer.wrap(regions).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(it) }
            } else {
                ShortArray(0)
            }
            return PlaceNames(file["names"].list().mapNotNull(::nameOf), listed, columns, rows, layers)
        }

        private fun nameOf(node: JsonNode): PlaceName? {
            val kind = NameKind.entries.firstOrNull { it.name.lowercase() == node.text("kind") }
            val at = node["at"]?.let(::placeOf)
            val earth = node["earth"]?.let(::placeOf)
            val id = node.text("id")
            val name = node.text("name")
            if (kind == null || at == null || earth == null || id == null || name == null) {
                return null
            }
            return PlaceName(
                id = id,
                kind = kind,
                name = name,
                also = node.text("also"),
                rank = node.number("rank"),
                elevation = node.number("elevation"),
                of1790 = node.text("form") == "1790",
                at = at,
                earth = earth,
                lines = node["lines"].list().map { run -> run.list().mapNotNull(::placeOf) }.filter { it.isNotEmpty() },
                about = node.text("about"),
            )
        }

        private fun regionOf(node: JsonNode): NamedRegion? {
            val kind = RegionKind.entries.firstOrNull { it.name.lowercase() == node.text("kind") }
            val id = node.text("id")
            val name = node.text("name")
            return if (kind == null || id == null || name == null) {
                null
            } else {
                NamedRegion(
                    id, kind, name, node.text("feature") ?: "", node.text("also"), node.text("form") == "1790", node.text("about"),
                )
            }
        }

        /** `[longitude, latitude]`, as the world package writes a place, or nothing for one off the Earth. */
        private fun placeOf(node: JsonNode): Location? {
            val lon = node[0]?.takeIf { it.isNumber }?.asDouble()
            val lat = node[1]?.takeIf { it.isNumber }?.asDouble()
            return if (lon == null || lat == null || lon !in -180.0..180.0 || lat !in -90.0..90.0) null else Location(lat, lon)
        }

        /**
         * An array's items, or none for anything else. Through `values()`, because a node's own `map` is Jackson's and
         * maps the node itself, and a member wins over Kotlin's `Iterable.map` without a word.
         */
        private fun JsonNode?.list(): Collection<JsonNode> = if (this != null && isArray) values() else emptyList()

        private fun JsonNode.text(field: String): String? = get(field)?.takeIf { it.isString }?.asString()

        private fun JsonNode.number(field: String): Double? = get(field)?.takeIf { it.isNumber }?.asDouble()
    }
}
