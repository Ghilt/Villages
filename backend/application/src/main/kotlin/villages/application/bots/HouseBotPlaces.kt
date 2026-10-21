package villages.application.bots

import villages.application.Balance
import villages.application.fate.GroundMap
import villages.application.fate.NameKind
import villages.application.fate.PlaceName
import villages.application.fate.kmBetween
import villages.domain.HouseError
import villages.domain.HouseName
import villages.domain.Location
import kotlin.math.cos
import kotlin.math.sin

/** Where a house bot stands: outside the ruin of which town of 1790, under that town's name, and its seat. */
data class HouseBotPlace(val town: String, val name: HouseName, val seat: Location)

/**
 * Where the world's house bots stand, worked out from the master's names and ground and the balance and from nothing
 * else, so that the same world gives the same bots on every tree and at every opening. See decision record 0108.
 *
 * The towns of 1790 are taken most important first: by their people in 1790 as `world/ruins.json` counts them, then
 * every town it does not list by the names' rank, a town with none last, and ties by id. A town carried onto the
 * master twice, where Adam copied land from one place on Earth to two, is taken once, at its copy furthest north and
 * then west, because a bot is its town's and stands by it once. Each one's seat stands
 * [Balance.HouseBots.beyondRuinKm] past the edge of its ruin, in a direction its id picks, turned an eighth at a time
 * until it stands on land. A town is passed over when it has no land at
 * that reach, when its name is not a house name, or when its seat would stand nearer another bot's than
 * [Balance.HouseBots.apartKm]; the rest are taken until there are [Balance.HouseBots.count].
 */
object HouseBotPlaces {
    fun of(towns: List<PlaceName>, ground: GroundMap, ruins: RuinReach, bots: Balance.HouseBots): List<HouseBotPlace> {
        val placed = mutableListOf<HouseBotPlace>()
        for (town in mostImportantFirst(towns, ruins)) {
            if (placed.size >= bots.count) break
            val name = nameOf(town) ?: continue
            val seat = seatOf(town, ruins.kmOf(town.id, town.at) + bots.beyondRuinKm, ground) ?: continue
            if (placed.any { kmBetween(it.seat, seat) < bots.apartKm }) continue
            placed += HouseBotPlace(town.id, name, seat)
        }
        return placed
    }

    private fun mostImportantFirst(towns: List<PlaceName>, ruins: RuinReach): List<PlaceName> =
        towns.filter { it.kind == NameKind.TOWN && it.of1790 }
            .sortedWith(
                compareBy<PlaceName, Long?>(nullsLast()) { ruins.peopleOf(it.id)?.unaryMinus() }
                    .thenBy(nullsLast()) { it.rank }
                    .thenBy { it.id }
                    .thenByDescending { it.at.lat }
                    .thenBy { it.at.lon },
            )
            .distinctBy { it.id }

    private fun nameOf(town: PlaceName): HouseName? =
        try {
            HouseName.of(town.name)
        } catch (_: HouseError.InvalidName) {
            null
        }

    /** The first place [km] from the town, in the directions its id picks, that is land and no river. */
    private fun seatOf(town: PlaceName, km: Double, ground: GroundMap): Location? {
        val first = Math.floorMod(town.id.hashCode(), FULL_TURN)
        return (0 until TRIES).asSequence()
            .map { turn -> along(town.at, km, (first + turn * FULL_TURN / TRIES).toDouble()) }
            .firstOrNull { ground.at(it).terrain.let { terrain -> terrain !in GroundMap.WATER && terrain != RIVER } }
    }

    /** The place [km] from [from] toward [degrees], clockwise from north: flat on the ground, near enough at this reach. */
    private fun along(from: Location, km: Double, degrees: Double): Location {
        val bearing = Math.toRadians(degrees)
        val across = KM_A_DEGREE * cos(Math.toRadians(from.lat)).coerceAtLeast(LEAST_COS)
        val lat = (from.lat + km * cos(bearing) / KM_A_DEGREE).coerceIn(-NEAR_A_POLE, NEAR_A_POLE)
        return Location(lat, wrapped(from.lon + km * sin(bearing) / across))
    }

    private fun wrapped(lon: Double): Double = ((lon + HALF_TURN) % FULL_TURN + FULL_TURN) % FULL_TURN - HALF_TURN

    private const val RIVER = "river"
    private const val TRIES = 8
    private const val FULL_TURN = 360
    private const val HALF_TURN = 180.0
    private const val NEAR_A_POLE = 89.9
    private const val KM_A_DEGREE = 111.32

    /** Never read a degree of longitude as narrower than at this cosine of its latitude. */
    private const val LEAST_COS = 0.05
}
