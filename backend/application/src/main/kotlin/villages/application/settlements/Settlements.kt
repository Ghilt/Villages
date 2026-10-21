package villages.application.settlements

import villages.application.Clock
import villages.application.Provenance
import villages.application.StructureCommandExecutor
import villages.application.StructuresByCell
import villages.application.WorldClock
import villages.application.fate.kmBetween
import villages.domain.Location
import villages.domain.RaiseStructure
import villages.domain.StructureError
import villages.domain.StructureId
import java.util.UUID

/**
 * The settlements of the world of 1790, raised at the opening: a village or a fishing village on every site the bake
 * chose that the world lacks, held by nobody, at the site's level and under its name, each under an id worked out from
 * its site so that no opening raises one twice. A site nearer than the balance's clearance to another structure's seat
 * is passed over, so that no village stands on a castle. What is there already is left alone: the read model says
 * which sites stand and they are not asked again, and one raised by an opening the read model has not heard of yet is
 * refused by its own history and passed over. See decision record 0114.
 */
class Settlements(
    private val structures: StructureCommandExecutor,
    private val standing: StructuresByCell,
    /** The sites of the world's master, none where the bake has not chosen them. */
    private val sites: () -> List<SettlementSite>,
    /** Where the seats stand that a settlement keeps clear of: the house bots'. */
    private val seats: () -> List<Location>,
    private val clearKm: () -> Double,
    private val clock: Clock,
    private val world: WorldClock,
) {
    /** What an opening did: how many sites there were, how many it raised, and how many it passed over for a seat. */
    data class Opened(val sites: Int, val raised: Int, val passedOver: Int)

    /** Raises a settlement on every site the world lacks, and says what it did. */
    fun open(): Opened {
        val here = sites()
        val clear = clearKm()
        val near = SeatsNear(seats(), clear)
        var raised = 0
        var passedOver = 0
        val today = world.today()
        val now = clock.now()
        for (site in here) {
            val id = StructureId.ofSettlement(site.id)
            if (standing.row(id) != null) continue
            if (near.within(site.place)) {
                passedOver += 1
                continue
            }
            try {
                structures.execute(
                    RaiseStructure(id, site.type, site.name, site.place, site.level, null, today, now),
                    Provenance.startedBy(RAISING),
                )
                raised += 1
            } catch (_: StructureError.AlreadyRaised) {
                // Raised at an opening the read model has not caught up with: its own history says so.
            }
        }
        return Opened(here.size, raised, passedOver)
    }

    /** The seats a settlement keeps clear of, kept in squares of a degree so a site asks only the ones near it. */
    private class SeatsNear(seats: List<Location>, private val km: Double) {
        private val squares = seats.groupBy { keyOf(it.lat, it.lon) }

        fun within(place: Location): Boolean {
            if (km <= 0.0) return false
            val reach = 1 + (km / KM_A_DEGREE).toInt()
            for (dLat in -reach..reach) {
                for (dLon in -reach..reach) {
                    val seats = squares[keyOf(place.lat + dLat, place.lon + dLon)] ?: continue
                    if (seats.any { kmBetween(it, place) < km }) return true
                }
            }
            return false
        }

        private fun keyOf(lat: Double, lon: Double): Long =
            Math.floor(lat).toLong() * 1_000 + Math.floorMod(Math.floor(lon).toLong(), 360L)
    }

    private companion object {
        /** The story every opening's raising of settlements is told in: the same each time, as only the first writes. */
        val RAISING: UUID = UUID.nameUUIDFromBytes("villages:opening:settlements".toByteArray(Charsets.UTF_8))

        /** Kilometres a degree of latitude spans, near enough for which squares to ask. */
        const val KM_A_DEGREE = 111.0
    }
}
