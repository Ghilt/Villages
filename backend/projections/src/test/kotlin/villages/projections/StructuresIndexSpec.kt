package villages.projections

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.list
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll
import villages.application.EventFeed
import villages.application.Start
import villages.application.StoredEvent
import villages.application.started
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.Event
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Significance
import villages.domain.StructureChangedHands
import villages.domain.StructureId
import villages.domain.StructureRaised
import villages.domain.StructureType
import villages.domain.Tincture
import villages.domain.WorldTime
import villages.domain.emptyStocks
import villages.protocol.Cell
import java.time.Instant
import java.util.UUID
import kotlin.random.Random

/** A feed that delivers what it is handed at once, each event at the next version of its own stream. */
private class Delivering : EventFeed {
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()
    private val versions = mutableMapOf<String, Long>()

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    fun deliver(event: Event, stream: String) {
        val version = versions.merge(stream, 1, Long::plus)!!
        val stored = StoredEvent(
            id = UUID.randomUUID().toString(), type = event::class.simpleName!!, stream = stream,
            streamVersion = version, time = event.recordedAt, data = "{}",
            correlationId = UUID.randomUUID().toString(), causationId = UUID.randomUUID().toString(), event = event,
        )
        subscribers.toList().forEach { it(stored) }
    }
}

/**
 * The structures' indexes against a plain scan of every row: for generated worlds - structures raised anywhere, held
 * by one of a few houses or by nobody, changing hands - every cell at every zoom and every house is answered exactly as
 * walking every structure would answer it. See docs/plans/indexed-read-models.md.
 */
class StructuresIndexSpec : StringSpec({
    val noon = Instant.parse("2026-10-17T12:00:00Z")
    val today = WorldTime(653_705)
    val banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT)
    val players = List(4) { PlayerId(UUID(0x5eedL, it.toLong())) }
    val houses = players.map(HouseId::of)

    "every cell and every house is answered as a scan of every structure would answer it" {
        checkAll(
            60,
            Arb.list(Arb.int(-800, 800), 1..60),
            Arb.long(),
            Arb.int(0, 40),
        ) { lats, seed, handings ->
            val random = Random(seed)
            val feed = Delivering()
            val structures = StructuresProjection(feed).started()
            players.forEachIndexed { index, player ->
                val house = HouseFounded(houses[index], player, HouseName("House $index"), Location(0.0, 0.0), Significance(20.0), banner, emptyStocks(noon), today, noon)
                feed.deliver(house, "house:$index")
            }
            // Clustered as today's seats cluster, so that cells hold many and some hold none.
            val raised = lats.map { lat ->
                val id = StructureId(UUID(random.nextLong(), random.nextLong()))
                val place = Location(lat / 80.0 + 50, random.nextDouble(-3.0, 3.0) + if (random.nextBoolean()) 0.0 else 100.0)
                val holder = houses.getOrNull(random.nextInt(houses.size + 1))
                feed.deliver(StructureRaised(id, StructureType("mill"), "a mill", place, Significance(10.0), 1, holder, today, noon), id.stream)
                id
            }
            repeat(handings) {
                val id = raised.random(random)
                val to = houses.getOrNull(random.nextInt(houses.size + 1))
                feed.deliver(StructureChangedHands(id, from = null, to = to, today, noon), id.stream)
            }

            val every = raised.mapNotNull(structures::row)
            val cells = every.flatMap { row ->
                val deepest = Cell.of(row.place.lat, row.place.lon).quadkey
                listOf(deepest.take(random.nextInt(0, deepest.length + 1)), deepest)
            } + listOf("", "3", "0123", "33333333")
            for (cell in cells) {
                val scanned = every.filter { Cell.of(it.place.lat, it.place.lon).quadkey.startsWith(cell) }
                structures.inCell(cell, everything = true).map { it.id }.toSet() shouldBe scanned.map { it.id }.toSet()
            }
            for (house in houses) {
                val scanned = every.filter { it.faces.last().holder?.house == house }
                structures.heldBy(house).map { it.id }.toSet() shouldBe scanned.map { it.id }.toSet()
            }
        }
    }
})
