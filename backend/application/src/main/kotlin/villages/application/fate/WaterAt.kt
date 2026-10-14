package villages.application.fate

import villages.domain.Location

/** What kind of water a player points at. */
enum class WaterKind { RIVER, LAKE, SEA }

/**
 * Water pointed at: what kind it is, and which, where the master's real names were carried - its real identity, a
 * Wikidata id where there is one, its name in English, and another worth knowing, today's beside a name of 1790 the
 * review chose, and a line or two [about] it for its window. Water nothing named is near enough to be has only its
 * kind and an [id] from the ground: the water painted there that the place is joined to, so that two clicks on one
 * unnamed lake are one window, as two on the Vistula are. [lines] are where it runs as the names have it, in the
 * world: a river's whole course, every piece of it under its name joined to the one pointed at, and a lake's shores;
 * none for the sea, or for water nobody has named. What a window's selection is drawn along.
 */
data class WaterHere(
    val kind: WaterKind,
    val id: String? = null,
    val name: String? = null,
    val also: String? = null,
    val of1790: Boolean = false,
    val about: String? = null,
    val lines: List<List<Location>> = emptyList(),
) {
    /**
     * As English says it inside a sentence: the Vistula, the German Ocean, the Lake of Geneva, but Lake Maeler and
     * Loch Ness, which take no article; and a river, a lake, a sea where nobody has named it.
     */
    val called: String
        get() = when {
            name == null -> "a ${kind.name.lowercase()}"
            name.startsWith("The ") -> "the ${name.removePrefix("The ")}"
            kind == WaterKind.LAKE && NO_ARTICLE.containsMatchIn(name) -> name
            else -> "the $name"
        }

    /** Its real identity, a Wikidata id or a source's; null for water nobody has named, whose [id] is the ground's. */
    val realId: String?
        get() = id?.takeUnless { it.startsWith(GROUND_ID) }

    companion object {
        /** What the id of water nobody has named starts with: it is known by the ground, not by a name. */
        const val GROUND_ID = "ground:"

        private val NO_ARTICLE = Regex("^(Lake|Loch|Lough) (?!of )")
    }
}

/**
 * The water a player points at: what the master's ground map has where they clicked, a river, a lake or the sea, and
 * which it is where the master's real names were carried. A lake by the shores the place lies inside, a river by the
 * nearest named river close enough to be the one painted there, as the map's omens find it, and the sea by the named
 * sea the place is in or by. The ground is read in cells some eighteen kilometres across, so where a cell holds more
 * than one water its own terrain says which: a cell mostly sea is the sea, and otherwise a river comes before a lake
 * and a lake before the sea along a shore. Water nothing names is known by the first cell of the water it is joined
 * to, `ground:<x>,<y>`. Whether the house may know is not asked here: that is the asker's to say,
 * from its fog or its sight. What an inspect window on water shows, and what a roll reads of one. See decision 0087.
 */
class WaterAt(private val grounds: GroundMaps, private val names: PlaceNamesByMaster) {
    /** The water at [place] on [master], or null where its ground has none. */
    fun at(master: String, place: Location): WaterHere? {
        val ground = grounds.of(master) ?: return null
        val cell = ground.at(place)
        val named = names.of(master)
        if (cell.has(GroundMap.LAKE)) {
            named?.inside(NameKind.LAKE, place)?.let { return named.waterOf(it, WaterKind.LAKE) }
        }
        val unnamed = { kind: WaterKind -> WaterHere(kind, ground.joinedId(MARKS.getValue(kind), place)) }
        return when {
            cell.has(GroundMap.SEA) && cell.terrain in MapOmens.SEAS -> seaAt(named, place) ?: unnamed(WaterKind.SEA)
            cell.has(GroundMap.RIVER) -> nearest(named, WaterKind.RIVER, place) ?: unnamed(WaterKind.RIVER)
            cell.has(GroundMap.LAKE) -> nearest(named, WaterKind.LAKE, place) ?: unnamed(WaterKind.LAKE)
            cell.has(GroundMap.SEA) -> seaAt(named, place) ?: unnamed(WaterKind.SEA)
            else -> null
        }
    }

    private fun nearest(named: PlaceNames?, kind: WaterKind, place: Location): WaterHere? =
        named?.near(if (kind == WaterKind.RIVER) NameKind.RIVER else NameKind.LAKE, place, MapOmens.RIVER_REACH_KM)
            ?.firstOrNull()?.name?.let { named.waterOf(it, kind) }

    private fun seaAt(named: PlaceNames?, place: Location): WaterHere? =
        named?.regionAt(place, RegionKind.SEA)
            ?.let { WaterHere(WaterKind.SEA, it.id, it.name, it.also, it.of1790, it.about) }

    private fun GroundMap.joinedId(mark: Int, place: Location): String? =
        waterJoinedTo(mark, indexOf(place))?.let { "${WaterHere.GROUND_ID}${it % width},${it / width}" }

    private fun PlaceNames.waterOf(piece: PlaceName, kind: WaterKind) =
        WaterHere(kind, piece.id, piece.name, piece.also, piece.of1790, piece.about, courseOf(piece))

    /**
     * Where a named water runs: a lake's shores, and a river's every piece under its name that joins this one or a
     * piece joined to it, end to end or side to side within [JOINED_KM], so that the Rhine's four pieces are one
     * course and another river of the same name elsewhere is not.
     */
    private fun PlaceNames.courseOf(piece: PlaceName): List<List<Location>> {
        if (piece.kind != NameKind.RIVER) {
            return piece.lines
        }
        val left = names.filter { it.kind == NameKind.RIVER && it.name == piece.name && it !== piece }.toMutableList()
        val taken = mutableListOf(piece)
        val waiting = ArrayDeque(taken)
        while (waiting.isNotEmpty()) {
            val one = waiting.removeFirst().lines.flatten()
            val joined = left.filter { other ->
                other.lines.flatten().any { b -> one.any { a -> kmBetween(a, b) <= JOINED_KM } }
            }
            left.removeAll(joined)
            taken += joined
            waiting += joined
        }
        return taken.flatMap { it.lines }
    }

    companion object {
        /** A world with no ground maps, where nothing is water. */
        val NOWHERE = WaterAt({ null }, { null })

        /** The mark on the ground that each kind of water is painted with. */
        private val MARKS = mapOf(
            WaterKind.RIVER to GroundMap.RIVER,
            WaterKind.LAKE to GroundMap.LAKE,
            WaterKind.SEA to GroundMap.SEA,
        )

        /** How close two pieces of a river under one name come to be one course. */
        const val JOINED_KM = 20.0
    }
}
