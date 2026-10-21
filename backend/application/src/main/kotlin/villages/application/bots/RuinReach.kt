package villages.application.bots

import villages.domain.Location
import kotlin.math.cos
import kotlin.math.sqrt

/**
 * How far the ruins of each town of 1790 reach, as `world/ruins.json` sizes them and the page lays them out (0103,
 * 0104): a built radius from the square root of the town's people in thousands, held between [least] and [most],
 * and an overgrown [ring] beyond it as a share of that, in world units. The server turns that into kilometres on the
 * ground where the town stands, because a world unit is narrower the further it is from the equator. A town the
 * file does not list had [unlisted] people.
 */
class RuinReach(
    private val perRootThousand: Double,
    private val least: Double,
    private val most: Double,
    private val ring: Double,
    private val unlisted: Long,
    /** The people of each town the file lists, by the town's id. */
    private val people: Map<String, Long>,
) {
    /** How many people [town] had in 1790, or null for a town the file does not list. */
    fun peopleOf(town: String): Long? = people[town]

    /** How far the ruins of [town], whose middle is [at], reach from it, in kilometres. */
    fun kmOf(town: String, at: Location): Double {
        val built = (perRootThousand * sqrt((people[town] ?: unlisted) / THOUSAND)).coerceIn(least, most)
        return built * (1 + ring) * KM_A_UNIT * cos(Math.toRadians(at.lat))
    }

    companion object {
        /** A world unit at the equator: the world is as many of them round as the master is pixels wide. */
        const val KM_A_UNIT = 40_075.017 / 32_768

        private const val THOUSAND = 1000.0
    }
}
