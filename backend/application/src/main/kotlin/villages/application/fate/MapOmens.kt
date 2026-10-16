package villages.application.fate

import villages.application.Balance
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
 *
 * Where the master's real names have been carried, the ground says whether and the names say what: the river is
 * the Vistula and the open sea the Baltic, under the same keys as a river and the open sea with no name, so a pool
 * opens on them just the same; and a town of 1790 standing in the circle is an omen of its own, by its key. See
 * decision record 0087.
 */
class MapOmens(
    private val grounds: GroundMaps,
    private val sights: SightsByHouse,
    private val houses: HousesNear,
    private val names: PlaceNamesByMaster = PlaceNamesByMaster { null },
    /** When ground, rivers, houses and towns are omens, and how many of them: the balance's. See 0097. */
    private val balance: () -> Balance,
) : OmenSource {
    override fun read(moment: Moment): List<Omen> {
        val centre = moment.looking.centre ?: return emptyList()
        val zoom = moment.looking.zoom ?: return emptyList()
        val ground = moment.looking.master?.let(grounds::of) ?: return emptyList()
        val named = moment.looking.master?.let(names::of)
        val radius = radiusAt(zoom, centre.lat)
        val numbers = balance().omens
        val sight = sights.of(moment.house.id)

        val revealed = sample(ground, centre, radius).filter { (place, _) -> sight.reveals(place) }
        val seen = revealed.map { it.second }
        if (seen.isEmpty()) {
            return listOf(Omen(OmenKeys.UNKNOWN, OmenKind.MAP, "Unknown"))
        }
        val land = seen.filter { it.has(GroundMap.COAST) || (!it.has(GroundMap.SEA) && it.terrain !in SEAS) }
        val omens = mutableListOf<Omen>()
        if (land.isEmpty()) {
            val sea = named?.let { seaOf(it, revealed) }
            omens += Omen(OmenKeys.OPEN_SEA, OmenKind.MAP, sea?.let { the(it.name) } ?: "Open sea")
        }
        if (seen.any { it.has(GroundMap.COAST) }) omens += Omen(OmenKeys.COAST, OmenKind.MAP, "Coast")
        if (radius <= numbers.riversWithinKm && seen.any { it.has(GroundMap.RIVER) }) {
            val river = named?.let { riverOf(it, revealed, centre) }
            omens += Omen(OmenKeys.RIVER, OmenKind.MAP, river?.let { the(it.name) } ?: "River")
        }
        if (named != null && radius <= numbers.townsWithinKm) {
            named.near(NameKind.TOWN, centre, radius)
                .filter { sight.reveals(it.name.at) }
                .take(numbers.mostTowns)
                .forEach { omens += Omen(OmenKeys.town(it.name.id), OmenKind.MAP, "Near ${it.name.name}") }
        }
        GROUNDS.forEach { (word, terrains) ->
            val share = land.count { it.terrain in terrains }.toDouble() / max(1, land.size)
            if (share >= numbers.groundPresent) omens += Omen(OmenKeys.ground(word.lowercase()), OmenKind.MAP, word)
        }
        if (radius <= numbers.housesWithinKm) {
            houses.near(centre, radius, moment.today)
                .filter { it.id != moment.house.id && sight.reveals(it.seat) }
                .sortedBy { kmBetween(it.seat, centre) }
                .take(numbers.mostHouses)
                .forEach { omens += Omen(OmenKeys.houseOnTheMap(it.id), OmenKind.MAP, "House ${it.name.value}") }
        }
        return omens
    }

    /** The sea most of the revealed circle is in or by, by name: open water is named by its nearest coast. */
    private fun seaOf(named: PlaceNames, revealed: List<Pair<Location, GroundCell>>): NamedRegion? =
        revealed.mapNotNull { (place, _) -> named.regionAt(place, RegionKind.SEA) }
            .groupingBy { it }.eachCount().maxByOrNull { it.value }?.key

    /**
     * The river nearest the centre that the ground shows and the house has revealed, by name: of the revealed cells a
     * river runs through, nearest first, the first with a named river close enough to be the one painted there.
     */
    private fun riverOf(named: PlaceNames, revealed: List<Pair<Location, GroundCell>>, centre: Location): PlaceName? =
        revealed.filter { (_, cell) -> cell.has(GroundMap.RIVER) }
            .sortedBy { (place, _) -> kmBetween(place, centre) }
            .firstNotNullOfOrNull { (place, _) -> named.near(NameKind.RIVER, place, RIVER_REACH_KM).firstOrNull()?.name }

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

        /**
         * How far from a cell the ground marks with a river a named river's line may run and still be the river painted
         * there: half a cell's diagonal, and a few pixels more for the painting and the carrying not agreeing exactly.
         */
        const val RIVER_REACH_KM = 18.0

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

        /** A name as it starts an omen: the Vistula, the Baltic Sea. */
        fun the(name: String): String = if (name.startsWith("The ")) name else "The $name"

        /** How far the looking circle reaches at a zoom, at a latitude, in kilometres. */
        fun radiusAt(zoom: Double, lat: Double): Double =
            max(LEAST_KM, LOOK_PX * KM_A_PIXEL_AT_NOUGHT / 2.0.pow(zoom) * cos(Math.toRadians(lat)))
    }
}
