package villages.projections

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll
import villages.application.EventFeed
import villages.application.Start
import villages.application.StoredEvent
import villages.application.fate.kmBetween
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
import villages.domain.Tincture
import villages.domain.WorldTime
import villages.domain.emptyStocks
import villages.protocol.Cell
import java.time.Instant
import java.util.UUID
import kotlin.random.Random

/** A feed that delivers what it is handed at once. */
private class Founding : EventFeed {
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    fun deliver(event: Event) {
        val stored = StoredEvent(
            id = UUID.randomUUID().toString(), type = event::class.simpleName!!, stream = "whatever", streamVersion = 1,
            time = event.recordedAt, data = "{}", correlationId = UUID.randomUUID().toString(),
            causationId = UUID.randomUUID().toString(), event = event,
        )
        subscribers.toList().forEach { it(stored) }
    }
}

/**
 * The houses near a place, from the cells round it, against measuring the distance to every house: for generated worlds
 * - houses clustered and scattered, near the equator and far north - and any reach from a few kilometres to thousands,
 * the same houses. See docs/plans/indexed-read-models.md.
 */
class HousesNearSpec : StringSpec({
    val noon = Instant.parse("2026-10-17T12:00:00Z")
    val today = WorldTime(653_705)
    val banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT)

    "the houses near a place, and in a cell, are those a walk of every house finds there" {
        checkAll(80, Arb.int(1, 80), Arb.long()) { count, seed ->
            val random = Random(seed)
            val feed = Founding()
            val houses = HousesProjection(feed).started()
            val north = random.nextBoolean()
            val ids = List(count) {
                val player = PlayerId(UUID(random.nextLong(), random.nextLong()))
                val lat = if (north) random.nextDouble(55.0, 80.0) else random.nextDouble(-20.0, 20.0)
                val seat = Location(lat, random.nextDouble(-10.0, 10.0))
                feed.deliver(HouseFounded(HouseId.of(player), player, HouseName("House $it"), seat, Significance(20.0), banner, emptyStocks(noon), today, noon))
                HouseId.of(player)
            }
            val every = ids.mapNotNull(houses::ofHouse)

            repeat(10) {
                val from = every.random(random).seat
                val place = Location((from.lat + random.nextDouble(-1.0, 1.0)).coerceIn(-85.0, 85.0), from.lon + random.nextDouble(-1.0, 1.0))
                val km = listOf(5.0, 50.0, 300.0, 1_500.0, 6_000.0).random(random) * random.nextDouble(0.5, 1.5)
                val scanned = every.filter { kmBetween(it.seat, place) <= km }.map { it.id }.toSet()
                houses.near(place, km, today).map { it.id }.toSet() shouldBe scanned
            }
            // And a cell at any zoom holds the houses whose seats are in it, as a walk of every house would find.
            for (house in every) {
                val deepest = Cell.of(house.seat.lat, house.seat.lon).quadkey
                val cell = deepest.take(random.nextInt(0, deepest.length + 1))
                val walked = every.filter { Cell.of(it.seat.lat, it.seat.lon).quadkey.startsWith(cell) }.map { it.id }.toSet()
                houses.inCell(cell, today, most = Int.MAX_VALUE, everything = true).houses.map { it.id }.toSet() shouldBe walked
            }
        }
    }
})
