package villages.projections

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.comparables.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
import villages.application.EventFeed
import villages.application.Holder
import villages.application.Start
import villages.application.StoredEvent
import villages.application.StructureChange
import villages.application.started
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.Event
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.HouseNamedSeat
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Significance
import villages.domain.StructureChangedHands
import villages.domain.StructureId
import villages.domain.StructureRaised
import villages.domain.StructureRebuilt
import villages.domain.StructureRuined
import villages.domain.StructureType
import villages.domain.Tincture
import villages.domain.WorldTime
import villages.domain.emptyStocks
import villages.protocol.Cell
import java.time.Instant
import java.util.UUID

/** A feed that delivers what it is handed at once, at the stream version it is told. */
private class FedByHand : EventFeed {
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    fun deliver(event: Event, version: Long = 1) {
        val stored = StoredEvent(
            id = UUID.randomUUID().toString(), type = event::class.simpleName!!, stream = "whatever",
            streamVersion = version, time = event.recordedAt, data = "{}",
            correlationId = UUID.randomUUID().toString(), causationId = UUID.randomUUID().toString(), event = event,
        )
        subscribers.toList().forEach { it(stored) }
    }
}

class StructuresProjectionSpec : StringSpec({
    val noon = Instant.parse("2026-10-08T12:00:00Z")
    val today = WorldTime(653_705)
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val sable = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT)
    val dantzic = Location(54.36, 18.64)
    val mill = StructureId(UUID.fromString("5d000000-0000-4000-8000-000000000001"))
    val founded = HouseFounded(HouseId.of(ada), ada, HouseName("Ravenscar"), dantzic, Significance(20.0), sable, emptyStocks(noon), today, noon)

    fun raised(holder: HouseId? = HouseId.of(ada), significance: Double = 10.0) =
        StructureRaised(mill, StructureType("mill"), "a new mill", dantzic, Significance(significance), 1, holder, today, noon)

    fun rig(): Pair<FedByHand, StructuresProjection> = FedByHand().let { it to StructuresProjection(it).started() }

    "a structure raised stands in the cells it is worth drawing in, with the face it was raised with" {
        val (feed, structures) = rig()
        feed.deliver(founded)
        feed.deliver(raised())

        val deepest = Cell.of(dantzic.lat, dantzic.lon).quadkey
        val row = structures.inCell(deepest.take(9)).single()
        row.name shouldBe "a new mill"
        val face = row.faces.single()
        face.holder shouldBe Holder(HouseId.of(ada), HouseName("Ravenscar"), sable)
        face.since shouldBe today
        row.faceOn(WorldTime(today.day - 1)) shouldBe null

        // Significance 10 is drawn from zoom 9: a coarser cell holds it only for the eye, which sets significance aside.
        structures.inCell(deepest.take(8)).shouldBeEmpty()
        structures.inCell(deepest.take(8), everything = true) shouldHaveSize 1
    }

    "nobody may hold it" {
        val (feed, structures) = rig()
        feed.deliver(raised(holder = null))

        structures.inCell("", everything = true).single().faces.single().holder shouldBe null
    }

    "an event delivered twice is folded once, and its listeners told once" {
        val (feed, structures) = rig()
        val told = mutableListOf<StructureChange>()
        structures.watch { told += it }

        feed.deliver(raised(), version = 1)
        feed.deliver(raised(), version = 1)

        told.single().appeared shouldBe true
        structures.inCell("", everything = true) shouldHaveSize 1
    }

    "a face is stamped with how many changes came before it, and a wipe forgets every structure but never the count" {
        val (feed, structures) = rig()
        feed.deliver(raised())
        val stamp = structures.inCell("", everything = true).single().faces.single().stamp
        structures.asOf() shouldBe stamp

        structures.reset()

        structures.inCell("", everything = true).shouldBeEmpty()
        structures.asOf() shouldBeGreaterThan stamp
    }

    "a structure that changed hands takes a new face from that day, and keeps the old one for whoever last saw it so" {
        val (feed, structures) = rig()
        val told = mutableListOf<StructureChange>()
        feed.deliver(founded)
        feed.deliver(raised(holder = null), version = 1)
        structures.watch { told += it }
        val later = WorldTime(today.day + 3)

        feed.deliver(StructureChangedHands(mill, from = null, to = HouseId.of(ada), later, noon), version = 2)
        feed.deliver(StructureChangedHands(mill, from = null, to = HouseId.of(ada), later, noon), version = 2)

        val row = structures.row(mill)!!
        row.faces.map { it.holder?.name } shouldBe listOf(null, HouseName("Ravenscar"))
        row.faces.last().stamp shouldBeGreaterThan row.faces.first().stamp
        row.faceOn(today)?.holder shouldBe null
        row.faceOn(later)?.holder?.name shouldBe HouseName("Ravenscar")
        told.single().appeared shouldBe false
    }

    "a structure named a house's seat takes a face saying whose, once, and loses it handed to another" {
        val (feed, structures) = rig()
        feed.deliver(founded)
        feed.deliver(raised(), version = 1)

        feed.deliver(HouseNamedSeat(HouseId.of(ada), mill, today, noon))
        feed.deliver(HouseNamedSeat(HouseId.of(ada), mill, today, noon))
        structures.row(mill)!!.faces.map { it.seatOf?.name } shouldBe listOf(null, HouseName("Ravenscar"))

        feed.deliver(StructureChangedHands(mill, from = HouseId.of(ada), to = null, today, noon), version = 2)
        structures.row(mill)!!.faces.last().seatOf shouldBe null
    }

    "a structure fallen to ruin takes a face holding nobody, and rebuilt one standing again" {
        val (feed, structures) = rig()
        feed.deliver(founded)
        feed.deliver(raised(), version = 1)

        feed.deliver(StructureRuined(mill, "fire", today, noon), version = 2)
        structures.row(mill)!!.faces.last().let { listOf(it.ruin, it.holder) } shouldBe listOf(true, null)

        feed.deliver(StructureRebuilt(mill, StructureType("mill"), 1, Significance(8.0), HouseId.of(ada), today, noon), version = 3)
        structures.row(mill)!!.faces.last().let { listOf(it.ruin, it.holder?.name) } shouldBe listOf(false, HouseName("Ravenscar"))
    }
})
