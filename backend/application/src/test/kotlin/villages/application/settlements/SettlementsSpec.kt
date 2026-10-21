package villages.application.settlements

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.application.Provenance
import villages.application.StructureChange
import villages.application.StructureCommandExecutor
import villages.application.StructureRow
import villages.application.StructuresByCell
import villages.domain.HouseId
import villages.domain.Location
import villages.domain.RaiseStructure
import villages.domain.StructureCommand
import villages.domain.StructureError
import villages.domain.StructureId
import villages.domain.StructureType
import villages.domain.WorldTime
import java.time.Instant

class SettlementsSpec : StringSpec({

    val noon = Instant.parse("2026-10-21T12:00:00Z")
    val house = StructureType("house")
    val dantzic = SettlementSite(
        "ruin:Q1792:0",
        SettlementKind.VILLAGE,
        3,
        "village by the ruins of Dantzic",
        Location(54.42, 18.71),
        "Q1792",
        14.0,
        listOf(
            SettlementBuilding(StructureType("market"), 1, Location(54.421, 18.712)),
            SettlementBuilding(house, 1, Location(54.422, 18.711)),
        ),
    )
    val geneva = SettlementSite(
        "site:1130:325",
        SettlementKind.FISHING_VILLAGE,
        1,
        "fishing village on the Lake of Geneva",
        Location(46.45, 6.51),
        null,
        5.0,
        listOf(SettlementBuilding(house, 1, Location(46.451, 6.513))),
    )
    val sites = listOf(dantzic, geneva)

    /** A store that keeps what it is asked to raise, and refuses a second raising as the decider would. */
    class Raised : StructureCommandExecutor {
        val commands = mutableListOf<RaiseStructure>()

        // Synchronised: the opening raises side by side.
        @Synchronized
        override fun execute(command: StructureCommand, provenance: Provenance) {
            val raise = command as RaiseStructure
            if (commands.any { it.structureId == raise.structureId }) throw StructureError.AlreadyRaised
            commands += raise
        }
    }

    /** A read model that has heard of the structures [store] raised only when told to catch up. */
    class Standing(private val store: Raised) : StructuresByCell {
        var heard = emptySet<StructureId>()


        fun catchUp() {
            heard = store.commands.map { it.structureId }.toSet()
        }

        override fun row(id: StructureId): StructureRow? =
            if (id in heard) StructureRow(id, "a settlement", Location(0.0, 0.0), emptyList()) else null

        override fun inCell(cell: String, everything: Boolean): List<StructureRow> = emptyList()

        override fun heldBy(house: HouseId): List<StructureRow> = emptyList()

        override fun all(): Sequence<StructureRow> = heard.asSequence().mapNotNull { row(it) }

        override fun asOf(): Long = 0

        override fun watch(listener: (StructureChange) -> Unit): AutoCloseable = AutoCloseable {}
    }

    fun opening(store: Raised, standing: StructuresByCell, seats: List<Location> = emptyList()) =
        Settlements(store, standing, { sites }, { seats }, { 4.0 }, { noon }, { WorldTime(653_705) })

    "raises every building of every site, held by nobody, at its level and place, named by its settlement" {
        val store = Raised()

        opening(store, Standing(store)).open() shouldBe Settlements.Opened(sites = 2, raised = 3, passedOver = 0)

        store.commands.map { it.structureId }.toSet() shouldBe setOf(
            StructureId.ofSettlementBuilding("ruin:Q1792:0", 0),
            StructureId.ofSettlementBuilding("ruin:Q1792:0", 1),
            StructureId.ofSettlementBuilding("site:1130:325", 0),
        )
        store.commands.map { it.name }.toSet() shouldBe setOf(
            "market in the village by the ruins of Dantzic",
            "house in the village by the ruins of Dantzic",
            "house in the fishing village on the Lake of Geneva",
        )
        store.commands.first { it.structureType.name == "market" }.place shouldBe Location(54.421, 18.712)
        store.commands.all { it.holder == null && it.level == 1 } shouldBe true
    }

    "opens again over a kept world and raises none twice, asking the read model and not the store" {
        val store = Raised()
        val standing = Standing(store)
        opening(store, standing).open()
        standing.catchUp()

        opening(store, standing).open() shouldBe Settlements.Opened(sites = 2, raised = 0, passedOver = 0)
        store.commands.size shouldBe 3
    }

    "raises none twice when the read model has not caught up either, the structure's history refusing it" {
        val store = Raised()
        val standing = Standing(store)
        opening(store, standing).open()

        opening(store, standing).open() shouldBe Settlements.Opened(sites = 2, raised = 0, passedOver = 0)
        store.commands.size shouldBe 3
    }

    "passes over a site within the clearance of a seat, every building of it, and raises the rest" {
        val store = Raised()
        val castle = Location(54.43, 18.72)

        opening(store, Standing(store), listOf(castle)).open() shouldBe Settlements.Opened(sites = 2, raised = 1, passedOver = 1)
        store.commands.map { it.name } shouldBe listOf("house in the fishing village on the Lake of Geneva")
    }

    "counts the sites, those standing whole, those passed over, and every building standing" {
        val store = Raised()
        val standing = Standing(store)
        val settlements = opening(store, standing, listOf(Location(54.43, 18.72)))
        settlements.open()
        standing.catchUp()

        settlements.tally() shouldBe Settlements.Tally(sites = 2, standing = 1, passedOver = 1, buildings = 1)
    }
})
