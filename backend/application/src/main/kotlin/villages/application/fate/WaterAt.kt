package villages.application.fate

import villages.domain.Location

/** What kind of water a player points at. */
enum class WaterKind { RIVER, LAKE, SEA }

/**
 * Water pointed at: what kind it is, and which, where the master's real names were carried - its real identity, a
 * Wikidata id where there is one, its name in English, and another worth knowing, today's beside a name of 1790 the
 * review chose. All but the kind null where nothing named is near enough to be the water painted there.
 */
data class WaterHere(
    val kind: WaterKind,
    val id: String? = null,
    val name: String? = null,
    val also: String? = null,
    val of1790: Boolean = false,
)

/**
 * The water a player points at: what the master's ground map has where they clicked, a river, a lake or the sea, and
 * which it is where the master's real names were carried. A lake by the shores the place lies inside, a river by the
 * nearest named river close enough to be the one painted there, as the map's omens find it, and the sea by the named
 * sea the place is in or by. The ground is read in cells some eighteen kilometres across, so where a cell holds more
 * than one water its own terrain says which: a cell mostly sea is the sea, and otherwise a river comes before a lake
 * and a lake before the sea along a shore. Whether the house may know is not asked here: that is the asker's to say,
 * from its fog or its sight. What an inspect window on water shows, and what a roll reads of one. See decision 0087.
 */
class WaterAt(private val grounds: GroundMaps, private val names: PlaceNamesByMaster) {
    /** The water at [place] on [master], or null where its ground has none. */
    fun at(master: String, place: Location): WaterHere? {
        val ground = grounds.of(master) ?: return null
        val cell = ground.at(place)
        val named = names.of(master)
        if (cell.has(GroundMap.LAKE)) {
            named?.inside(NameKind.LAKE, place)?.let { return it.asWater(WaterKind.LAKE) }
        }
        return when {
            cell.has(GroundMap.SEA) && cell.terrain in MapOmens.SEAS -> seaAt(named, place)
            cell.has(GroundMap.RIVER) -> nearest(named, WaterKind.RIVER, NameKind.RIVER, place)
            cell.has(GroundMap.LAKE) -> nearest(named, WaterKind.LAKE, NameKind.LAKE, place)
            cell.has(GroundMap.SEA) -> seaAt(named, place)
            else -> null
        }
    }

    private fun nearest(named: PlaceNames?, kind: WaterKind, name: NameKind, place: Location): WaterHere =
        named?.near(name, place, MapOmens.RIVER_REACH_KM)?.firstOrNull()?.name?.asWater(kind) ?: WaterHere(kind)

    private fun seaAt(named: PlaceNames?, place: Location): WaterHere =
        named?.regionAt(place, RegionKind.SEA)
            ?.let { WaterHere(WaterKind.SEA, it.id, it.name, it.also, it.of1790) }
            ?: WaterHere(WaterKind.SEA)

    private fun PlaceName.asWater(kind: WaterKind) = WaterHere(kind, id, name, also, of1790)

    companion object {
        /** A world with no ground maps, where nothing is water. */
        val NOWHERE = WaterAt({ null }, { null })
    }
}
