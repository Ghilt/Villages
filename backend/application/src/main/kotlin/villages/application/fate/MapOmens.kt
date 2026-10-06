package villages.application.fate

import villages.application.HouseRow
import villages.application.SightsByHouse
import villages.domain.Location
import villages.domain.Omen
import villages.domain.OmenKind
import villages.domain.WorldTime
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.sqrt

/** The houses standing within some kilometres of a place on a day, for the map's omens. */
fun interface HousesNear {
    fun near(place: Location, km: Double, at: WorldTime): List<HouseRow>
}

/**
 * Where the player is looking, as omens, worked out by the server from the centre of their view and how close it
 * is, and never taken from the page: the **looking circle** about the centre, as wide as an ordinary window shows
 * at that zoom, read against the master's ground map and the house's fog. Only revealed ground counts, so a circle
 * of nothing but fog is the one omen *Unknown*. Zoomed out the circle is wide and its omens broad - coast,
 * mountains; zoomed in it is narrow and the houses standing in it are omens by name. See decision record 0084.
 */
class MapOmens(
    private val grounds: GroundMaps,
    private val sights: SightsByHouse,
    private val houses: HousesNear,
) : OmenSource {
    override fun read(moment: Moment): List<Omen> {
        val centre = moment.looking.centre ?: return emptyList()
        val zoom = moment.looking.zoom ?: return emptyList()
        val ground = moment.looking.master?.let(grounds::of) ?: return emptyList()
        val radius = radiusAt(zoom, centre.lat)
        val sight = sights.of(moment.house.id)

        val seen = sample(ground, centre, radius).filter { (place, _) -> sight.reveals(place) }.map { it.second }
        if (seen.isEmpty()) {
            return listOf(Omen(OmenKeys.UNKNOWN, OmenKind.MAP, "Unknown"))
        }
        val land = seen.filter { it.has(GroundMap.COAST) || (!it.has(GroundMap.SEA) && it.terrain !in SEAS) }
        val omens = mutableListOf<Omen>()
        if (land.isEmpty()) {
            omens += Omen(OmenKeys.OPEN_SEA, OmenKind.MAP, "Open sea")
        }
        if (seen.any { it.has(GroundMap.COAST) }) omens += Omen(OmenKeys.COAST, OmenKind.MAP, "Coast")
        if (radius <= RIVERS_WITHIN_KM && seen.any { it.has(GroundMap.RIVER) }) {
            omens += Omen(OmenKeys.RIVER, OmenKind.MAP, "River")
        }
        GROUNDS.forEach { (word, terrains) ->
            val share = land.count { it.terrain in terrains }.toDouble() / max(1, land.size)
            if (share >= PRESENT) omens += Omen(OmenKeys.ground(word.lowercase()), OmenKind.MAP, word)
        }
        if (radius <= HOUSES_WITHIN_KM) {
            houses.near(centre, radius, moment.today)
                .filter { it.id != moment.house.id && sight.reveals(it.seat) }
                .sortedBy { kmBetween(it.seat, centre) }
                .take(MOST_HOUSES)
                .forEach { omens += Omen(OmenKeys.houseOnTheMap(it.id), OmenKind.MAP, "House ${it.name.value}") }
        }
        return omens
    }

    /** The cells of the circle, every one where there are few enough and an even spread of them where not. */
    private fun sample(ground: GroundMap, centre: Location, km: Double): List<Pair<Location, GroundCell>> {
        val degreesDown = km / KM_A_DEGREE
        val degreesAcross = km / (KM_A_DEGREE * max(cos(Math.toRadians(centre.lat)), 0.05))
        val x0 = ((centre.lon - degreesAcross + 180) / 360 * ground.width).toInt()
        val x1 = ((centre.lon + degreesAcross + 180) / 360 * ground.width).toInt()
        val y0 = ((90 - (centre.lat + degreesDown)) / 180 * ground.height).toInt().coerceIn(0, ground.height - 1)
        val y1 = ((90 - (centre.lat - degreesDown)) / 180 * ground.height).toInt().coerceIn(0, ground.height - 1)
        val area = (x1 - x0 + 1).toDouble() * (y1 - y0 + 1)
        val stride = max(1, ceil(sqrt(area / MOST_CELLS)).toInt())
        val cells = mutableListOf<Pair<Location, GroundCell>>()
        for (y in y0..y1 step stride) {
            for (xs in x0..x1 step stride) {
                val x = Math.floorMod(xs, ground.width)
                val place = ground.middleOf(x, y)
                if (kmBetween(place, centre) <= km) cells += place to ground.cell(x, y)
            }
        }
        return cells
    }

    companion object {
        /** How many pixels from the middle of an ordinary window to its side: what the looking circle is as wide as. */
        const val LOOK_PX = 640.0

        /** The ground a web map's pixel covers at zoom nought on the equator, in kilometres. */
        const val KM_A_PIXEL_AT_NOUGHT = 156.543

        /** Never narrower than this, so that the closest look still has a little ground about it. */
        const val LEAST_KM = 5.0

        private const val KM_A_DEGREE = 111.32

        /** The share of the revealed land in the circle a kind of ground needs to be an omen. */
        const val PRESENT = 0.15

        /** A river is an omen only this close: from further out every land has one, and it says nothing. */
        const val RIVERS_WITHIN_KM = 400.0

        /** Houses are omens by name only zoomed in this close: a circle this wide or less. */
        const val HOUSES_WITHIN_KM = 150.0

        const val MOST_HOUSES = 3

        /** Cells the circle is read at, at most; a wider circle is read at an even spread of them. */
        const val MOST_CELLS = 200_000

        /** The terrain classes that are the sea, whatever marks a cell carries. */
        val SEAS = setOf("ocean", "shallow-sea")

        /** The kinds of ground an omen can name, and the terrain classes each is made of. */
        val GROUNDS: List<Pair<String, Set<String>>> = listOf(
            "Forest" to setOf(
                "taiga", "conifer-forest", "broadleaf-forest", "mixed-forest", "rainforest", "dry-forest",
                "mangrove", "swamp-forest", "farmland-with-woods",
            ),
            "Mountains" to setOf("alpine-meadow", "bare-rock"),
            "Fields" to setOf("farmland", "paddy", "farmland-with-woods"),
            "Grassland" to setOf("steppe", "meadow", "savanna", "heath", "scrub", "taiga-open"),
            "Desert" to setOf("desert-sand", "desert-stone", "salt-flat", "polar-desert"),
            "Marsh" to setOf("marsh", "bog", "floodplain", "swamp-forest"),
            "Ice" to setOf("ice", "tundra"),
        )

        /** How far the looking circle reaches at a zoom, at a latitude, in kilometres. */
        fun radiusAt(zoom: Double, lat: Double): Double =
            max(LEAST_KM, LOOK_PX * KM_A_PIXEL_AT_NOUGHT / 2.0.pow(zoom) * cos(Math.toRadians(lat)))
    }
}
