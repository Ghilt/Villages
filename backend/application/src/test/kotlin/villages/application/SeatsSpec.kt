package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.FoundHouse
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.HouseNamedSeat
import villages.domain.LevelSpec
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Significance
import villages.domain.StructureCatalogue
import villages.domain.StructureId
import villages.domain.StructureRaised
import villages.domain.StructureSpec
import villages.domain.StructureType
import villages.domain.Tincture
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID

/** Founding raises the house's castle and names it the seat, through the seats listener. See decision record 0092. */
class SeatsSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val today = WorldTime(653_705)
    val catalogue = StructureCatalogue(
        mapOf(StructureType("castle") to StructureSpec(listOf(LevelSpec(Significance(20.0), 34.0, emptyMap())), emptyList())),
    )
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val seat = Location(59.33, 18.07)

    fun found(world: TinyWorld) = world.execute(
        FoundHouse(HouseId.of(ada), ada, HouseName("Ravenscar"), seat, Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT), today, noon),
        Provenance.startedBy(UUID.randomUUID()),
    )

    fun TinyWorld.seats(later: ManualLater, faults: KeptFaults) = Seats(this, later, faults, this, this, { noon }).started()

    "founding raises the house's castle where it was founded, held by the house, and names it the seat, in the founding's story" {
        val world = TinyWorld(catalogue)
        val later = ManualLater()
        val faults = KeptFaults()
        world.seats(later, faults)

        found(world)
        later.tick()
        later.tick()

        val castle = StructureId.seatOf(HouseId.of(ada))
        val raised = world.stored.map { it.event }.filterIsInstance<StructureRaised>().single()
        listOf(raised.structureId, raised.name, raised.place, raised.holder, raised.worldTime) shouldBe
            listOf(castle, "Ravenscar Castle", seat, HouseId.of(ada), today)
        world.stored.last().event shouldBe HouseNamedSeat(HouseId.of(ada), castle, today, noon)
        world.founded(HouseId.of(ada)).seatedIn shouldBe castle
        val founding = world.stored.first { it.event is HouseFounded }
        world.stored.takeLast(2).map { it.correlationId }.distinct() shouldBe listOf(founding.correlationId)
        faults.reported.shouldBeEmpty()
    }

    "the history heard again on a start asks twice and writes nothing" {
        val world = TinyWorld(catalogue)
        val later = ManualLater()
        val faults = KeptFaults()
        world.seats(later, faults)
        found(world)
        later.tick()
        later.tick()
        val written = world.stored.size

        world.seats(later, faults)
        later.tick()
        later.tick()

        world.stored.size shouldBe written
        world.stored.last().event.shouldBeInstanceOf<HouseNamedSeat>()
        faults.reported.shouldBeEmpty()
    }
})
