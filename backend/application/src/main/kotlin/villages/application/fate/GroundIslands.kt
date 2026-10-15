package villages.application.fate

import villages.application.Islands
import villages.domain.Location

/**
 * Islands read off a master's ground map: the land mass a place stands on, measured, against [ISLAND_KM2]. The master
 * is the world's, named when the server starts, because a structure stands in the one world whatever page looks at
 * it. See decision record 0096.
 */
class GroundIslands(private val ground: GroundMaps, private val master: String) : Islands {
    override fun onAnIsland(place: Location): Boolean {
        val map = ground.of(master) ?: return false
        val land = map.landJoinedTo(map.indexOf(place)) ?: return false
        return map.areaOfLand(land) < ISLAND_KM2
    }

    companion object {
        /**
         * Land smaller than this is an island, in square kilometres: between the largest island and the smallest
         * continent on the master, measured on 2026-10-15 at 2.15 million, Greenland, and 5.84 million, the land Adam
         * set at 45 south. A placeholder, Adam's to tune.
         */
        const val ISLAND_KM2 = 4_000_000.0
    }
}
