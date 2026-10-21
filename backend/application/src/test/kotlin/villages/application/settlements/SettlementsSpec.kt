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
    val dantzic = SettlementSite("ruin:Q1792:0", StructureType.VILLAGE, 3, "village by the ruins of Dantzic", Location(54.42, 18.71), "Q1792")
    val geneva = SettlementSite(
        "site:1130:325", StructureType.FISHING_VILLAGE, 1, "fishing village on the Lake of Geneva", Location(46.45, 6.51), null,
    )
    val sites = listOf(dantzic, geneva)

    /** A store that keeps what it is asked to raise, and refuses a second raising as the decider would. */
    class Raised : StructureCommandExecutor {
        val commands = mutableListOf<RaiseStructure>()

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

        override fun asOf(): Long = 0

        override fun watch(listener: (StructureChange) -> Unit): AutoCloseable = AutoCloseable {}
    }

    fun opening(store: Raised, standing: StructuresByCell, seats: List<Location> = emptyList()) =
        Settlements(store, standing, { sites }, { seats }, { 4.0 }, { noon }, { WorldTime(653_705) })

    "raises a settlement on every site, held by nobody, at its level and under its name and an id from its site" {
        val store = Raised()

        opening(store, Standing(store)).open() shouldBe Settlements.Opened(sites = 2, raised = 2, passedOver = 0)

        store.commands.map { it.structureId } shouldBe listOf(StructureId.ofSettlement("ruin:Q1792:0"), StructureId.ofSettlement("site:1130:325"))
        store.commands.map { it.structureType } shouldBe listOf(StructureType.VILLAGE, StructureType.FISHING_VILLAGE)
        store.commands.map { it.name } shouldBe listOf("village by the ruins of Dantzic", "fishing village on the Lake of Geneva")
        store.commands.map { it.level } shouldBe listOf(3, 1)
        store.commands.map { it.place } shouldBe listOf(dantzic.place, geneva.place)
        store.commands.all { it.holder == null } shouldBe true
    }

    "opens again over a kept world and raises none twice, asking the read model and not the store" {
        val store = Raised()
        val standing = Standing(store)
        opening(store, standing).open()
        standing.catchUp()

        opening(store, standing).open() shouldBe Settlements.Opened(sites = 2, raised = 0, passedOver = 0)
        store.commands.size shouldBe 2
    }

    "raises none twice when the read model has not caught up either, the structure's history refusing it" {
        val store = Raised()
        val standing = Standing(store)
        opening(store, standing).open()

        opening(store, standing).open() shouldBe Settlements.Opened(sites = 2, raised = 0, passedOver = 0)
        store.commands.size shouldBe 2
    }

    "passes over a site within the clearance of a seat, and raises the rest" {
        val store = Raised()
        val castle = Location(54.43, 18.72)

        opening(store, Standing(store), listOf(castle)).open() shouldBe Settlements.Opened(sites = 2, raised = 1, passedOver = 1)
        store.commands.map { it.name } shouldBe listOf("fishing village on the Lake of Geneva")
    }
})
