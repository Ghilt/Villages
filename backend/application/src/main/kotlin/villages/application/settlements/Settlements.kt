package villages.application.settlements

import villages.application.Clock
import villages.application.Provenance
import villages.application.StructureCommandExecutor
import villages.application.StructuresByCell
import villages.application.WorldClock
import villages.domain.Location
import villages.domain.RaiseStructure
import villages.domain.StructureError
import villages.domain.StructureId
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * The settlements of the world of 1790, raised at the opening building by building: every building of every site the
 * bake laid out that the world lacks, a structure of its own held by nobody, at its level, named by its settlement -
 * *house in the village by the Vistula* - under an id worked out from its site and its number, so that no opening
 * raises one twice. Nothing is raised for the settlement itself, which is its buildings, its name and its radius. A
 * site nearer than the balance's clearance to a seat is passed over whole, so that no village stands on a castle. What
 * is there already is left alone: the read model says which buildings stand and they are not asked again, and one
 * raised by an opening the read model has not heard of yet is refused by its own history and passed over. The buildings
 * are raised side by side, each its own history. See decision records 0114 and 0117.
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
    /** How many buildings are raised at once. */
    private val together: Int = 8,
) {
    /** What an opening did: how many sites there were, how many buildings it raised, and how many sites it passed over. */
    data class Opened(val sites: Int, val raised: Int, val passedOver: Int)

    /**
     * The settlements as the world has them now: how many sites the master has, how many of them stand whole - every
     * building raised - how many are passed over for a seat, and how many of all their buildings stand.
     */
    data class Tally(val sites: Int, val standing: Int, val passedOver: Int, val buildings: Int)

    /** The settlements counted, as the World section of the debug panel shows them. */
    fun tally(): Tally {
        val here = sites()
        val near = PlacesNear(seats(), clearKm())
        var whole = 0
        var passedOver = 0
        var buildings = 0
        for (site in here) {
            val up = site.buildings.indices.count { standing.row(StructureId.ofSettlementBuilding(site.id, it)) != null }
            buildings += up
            if (up == site.buildings.size) whole += 1 else if (near.within(site.place)) passedOver += 1
        }
        return Tally(here.size, whole, passedOver, buildings)
    }

    /** Raises every building of every site the world lacks, and says what it did. */
    fun open(): Opened {
        val here = sites()
        val near = PlacesNear(seats(), clearKm())
        val today = world.today()
        val now = clock.now()
        var passedOver = 0
        val raises = mutableListOf<RaiseStructure>()
        for (site in here) {
            if (near.within(site.place)) {
                passedOver += 1
                continue
            }
            site.buildings.forEachIndexed { number, building ->
                val id = StructureId.ofSettlementBuilding(site.id, number)
                if (standing.row(id) == null) {
                    val name = "${building.type.inWords} in the ${site.name}"
                    raises += RaiseStructure(id, building.type, name, building.place, building.level, null, today, now)
                }
            }
        }
        val raised = AtomicInteger()
        val pool = Executors.newFixedThreadPool(together.coerceAtLeast(1))
        try {
            val done = raises.map { raise -> pool.submit { if (raise(raise)) raised.incrementAndGet() } }
            done.forEach { it.get() }
        } finally {
            pool.shutdown()
            pool.awaitTermination(1, TimeUnit.MINUTES)
        }
        return Opened(here.size, raised.get(), passedOver)
    }

    private fun raise(command: RaiseStructure): Boolean = try {
        structures.execute(command, Provenance.startedBy(RAISING))
        true
    } catch (_: StructureError.AlreadyRaised) {
        // Raised at an opening the read model has not caught up with: its own history says so.
        false
    }

    private companion object {
        /** The story every opening's raising of settlements is told in: the same each time, as only the first writes. */
        val RAISING: UUID = UUID.nameUUIDFromBytes("villages:opening:settlements".toByteArray(Charsets.UTF_8))
    }
}
