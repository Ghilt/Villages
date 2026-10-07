package villages.application.fate

import villages.domain.Location
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max

/** What a named thing is. */
enum class NameKind { RIVER, LAKE, PEAK, TOWN }

/** Whether a named region is water or land. */
enum class RegionKind { SEA, LAND }

/**
 * One of Earth's named things carried into a master's world. [id] is the real world's identity of it, a Wikidata id
 * where there is one, and it never changes when Adam repaints: it is what a questline names a place by. [name] is
 * the English one, the one an English writer of 1790 used where [of1790] says it was reviewed for that, and today's
 * until then; [also] is another worth knowing, a town's today. [at] is where its name stands in the world, [earth]
 * the same place on Earth, and [lines] a river's runs or a lake's shores in the world, none for a point.
 */
data class PlaceName(
    val id: String,
    val kind: NameKind,
    val name: String,
    val also: String?,
    /** How much it matters, from nought the most: the source's own rank, for now today's. */
    val rank: Double?,
    /** Metres, for a peak. */
    val elevation: Double?,
    val of1790: Boolean,
    val at: Location,
    val earth: Location,
    val lines: List<List<Location>>,
)

/** A named sea or stretch of land: the Baltic Sea, a gulf, a strait; Pomerania, the Alps. */
data class NamedRegion(val id: String, val kind: RegionKind, val name: String, val feature: String)

/** A named thing near a place, and how far from it, in kilometres. */
data class NamedNear(val name: PlaceName, val km: Double)

/**
 * A master's real names as the server holds them: every named thing carried into its world, and for every square of
 * its origin map the land it is in and the sea it is by. Filed by `world:names` beside the ground map, the same
 * bytes the page reads; the shape is a contract, held by `contracts/fixtures/names.json`. See decision record 0087.
 */
class PlaceNames(
    val names: List<PlaceName>,
    val regions: List<NamedRegion>,
    private val columns: Int,
    private val rows: Int,
    /** For each square a region's number, counting [regions] from one, nought for none: the land, then the sea. */
    private val layers: ShortArray,
) {
    init {
        require(layers.isEmpty() || layers.size == columns * rows * 2) {
            "two layers of $columns by $rows squares are ${columns * rows * 2} numbers"
        }
    }

    /** Every name's points and pieces of line, filed by each degree square they cross, so a question reads a few. */
    private val filed: Map<Int, List<Piece>> by lazy {
        val filed = HashMap<Int, MutableList<Piece>>()
        names.flatMap(::piecesOf).forEach { piece ->
            for (square in piece.squares()) filed.getOrPut(square) { mutableListOf() } += piece
        }
        filed
    }

    /**
     * The named things of a kind within some kilometres of a place, nearest first, each with how far it is: from
     * its line, for a river or a lake's shore, or from its point. Whether the house has revealed it is the asker's
     * to say, because only the asker knows whose house is asking.
     */
    fun near(kind: NameKind, place: Location, km: Double): List<NamedNear> {
        val down = km / KM_A_DEGREE
        val across = km / (KM_A_DEGREE * max(cos(Math.toRadians(place.lat)), LEAST_COS))
        val lons = if (across >= HALF_TURN) -HALF_TURN..HALF_TURN else place.lon - across..place.lon + across
        val nearest = HashMap<String, NamedNear>()
        for (square in squares(place.lat - down..place.lat + down, lons)) {
            for (piece in filed[square].orEmpty()) {
                if (piece.name.kind != kind) continue
                val far = piece.kmFrom(place)
                if (far <= km && far < (nearest[piece.name.id]?.km ?: Double.MAX_VALUE)) {
                    nearest[piece.name.id] = NamedNear(piece.name, far)
                }
            }
        }
        return nearest.values.sortedBy { it.km }
    }

    /** The named land a place is in, or the named sea it is in or by: open water's is its nearest coast's. */
    fun regionAt(place: Location, kind: RegionKind): NamedRegion? {
        if (layers.isEmpty()) {
            return null
        }
        val x = floor((place.lon + HALF_TURN) / (2 * HALF_TURN) * columns).toInt().coerceIn(0, columns - 1)
        val y = floor((QUARTER_TURN - place.lat) / (2 * QUARTER_TURN) * rows).toInt().coerceIn(0, rows - 1)
        val layer = if (kind == RegionKind.LAND) 0 else 1
        val number = layers[(layer * rows + y) * columns + x].toInt() and UNSIGNED
        return regions.getOrNull(number - 1)?.takeIf { it.kind == kind }
    }

    /** A point, or a straight piece of a line between two of its points, and whose it is. */
    private class Piece(val name: PlaceName, val from: Location, val to: Location) {
        fun squares(): List<Int> =
            squares(minOf(from.lat, to.lat)..maxOf(from.lat, to.lat), minOf(from.lon, to.lon)..maxOf(from.lon, to.lon))

        /** How far a place is from the piece, measured flat on the ground about the place: near enough at this reach. */
        fun kmFrom(place: Location): Double {
            if (from == to) {
                return kmBetween(place, from)
            }
            val across = KM_A_DEGREE * cos(Math.toRadians(place.lat))
            val ax = turned(from.lon - place.lon) * across
            val ay = (from.lat - place.lat) * KM_A_DEGREE
            val dx = turned(to.lon - place.lon) * across - ax
            val dy = (to.lat - place.lat) * KM_A_DEGREE - ay
            val length = dx * dx + dy * dy
            val along = if (length == 0.0) 0.0 else (-(ax * dx + ay * dy) / length).coerceIn(0.0, 1.0)
            return hypot(ax + along * dx, ay + along * dy)
        }
    }

    private companion object {
        const val HALF_TURN = 180.0
        const val QUARTER_TURN = 90.0
        const val KM_A_DEGREE = 111.32
        const val UNSIGNED = 0xFFFF

        /** Never read a circle as wider than at this cosine of its latitude, so that near a pole it is not the world. */
        const val LEAST_COS = 0.05

        /** A name's pieces: each straight piece of each run of its lines, or its one point. */
        fun piecesOf(name: PlaceName): List<Piece> =
            if (name.lines.isEmpty()) {
                listOf(Piece(name, name.at, name.at))
            } else {
                // A piece across the date line is a jump in the drawing, not a river the world long.
                name.lines.flatMap { run -> run.zipWithNext { a, b -> Piece(name, a, b) } }
                    .filter { abs(it.from.lon - it.to.lon) <= HALF_TURN }
            }

        /** The degree squares a stretch of latitude and longitude covers, longitude taken round the world. */
        fun squares(lats: ClosedFloatingPointRange<Double>, lons: ClosedFloatingPointRange<Double>): List<Int> {
            val rows = floor(lats.start + QUARTER_TURN).toInt().coerceAtLeast(0)..
                floor(lats.endInclusive + QUARTER_TURN).toInt().coerceAtMost(2 * QUARTER_TURN.toInt() - 1)
            val across = 2 * HALF_TURN.toInt()
            val columns = (floor(lons.start).toInt()..floor(lons.endInclusive).toInt())
                .map { Math.floorMod(it + HALF_TURN.toInt(), across) }.distinct()
            return rows.flatMap { row -> columns.map { column -> row * across + column } }
        }

        /** A difference of longitude the short way round, between half a turn west and half a turn east. */
        fun turned(degrees: Double): Double = (degrees + HALF_TURN).mod(2 * HALF_TURN) - HALF_TURN
    }
}

/** Each master's real names, by the master's name, or null for a master with none. */
fun interface PlaceNamesByMaster {
    fun of(master: String): PlaceNames?
}
