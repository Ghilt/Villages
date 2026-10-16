package villages.application.fate

import villages.application.Balance
import villages.application.Islands
import villages.domain.Location

/**
 * Islands read off a master's ground map: the land mass a place stands on, measured, against the balance's
 * `islands.smallerThanKm2`, which lies between the largest island and the smallest continent on the master - measured
 * on 2026-10-15 at 2.15 million square kilometres, Greenland, and 5.84 million, the land Adam set at 45 south. The
 * master is the world's, named when the server starts, because a structure stands in the one world whatever page
 * looks at it. See decision records 0096 and 0097.
 */
class GroundIslands(
    private val ground: GroundMaps,
    private val master: String,
    private val balance: () -> Balance,
) : Islands {
    override fun onAnIsland(place: Location): Boolean {
        val map = ground.of(master) ?: return false
        val land = map.landJoinedTo(map.indexOf(place)) ?: return false
        return map.areaOfLand(land) < balance().islands.smallerThanKm2
    }
}
