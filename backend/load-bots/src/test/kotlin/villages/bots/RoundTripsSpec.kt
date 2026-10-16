package villages.bots

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import villages.protocol.Cell
import villages.protocol.Point

class RoundTripsSpec : StringSpec({

    "times a trip by its key, ignores one nobody started, and forgets what it has handed over" {
        val trips = RoundTrips()
        trips.started(Trip.ACCEPTED, "a", 100)
        trips.finished(Trip.ACCEPTED, "a", 130)
        trips.finished(Trip.ACCEPTED, "b", 140)

        trips.drain().took.getValue(Trip.ACCEPTED) shouldBe listOf(30L)
        trips.drain().took.getValue(Trip.ACCEPTED).shouldBeEmpty()
    }

    "reads percentiles from the sorted trips" {
        val trips = RoundTrips()
        (1..100).forEach { trips.started(Trip.WELCOME, "$it", 0); trips.finished(Trip.WELCOME, "$it", it.toLong()) }
        val measured = trips.drain()
        measured.percentile(Trip.WELCOME, 0.5) shouldBe 50L
        measured.percentile(Trip.WELCOME, 0.95) shouldBe 95L
        measured.percentile(Trip.SNAPSHOT, 0.5) shouldBe null
    }

    "counts a trip never answered within the limit as a failure, once" {
        val trips = RoundTrips()
        trips.started(Trip.SNAPSHOT, "late", 0)
        trips.started(Trip.SNAPSHOT, "early", 4_000)

        trips.overdue(now = 6_000, limit = 5_000) shouldBe 1
        trips.overdue(now = 6_000, limit = 5_000) shouldBe 0
        trips.drain().reasons shouldBe mapOf("no snapshot within 5000 ms" to 1)
    }

    "a neighbourhood is the seat's cell and the eight round it, fewer at the top of the world" {
        val seat = Point(48.85, 2.35)
        val round = Neighbourhood.round(seat)
        round.toSet() shouldHaveSize 9
        round.first { it == Cell.of(seat.lat, seat.lon, Neighbourhood.ZOOM).quadkey }
        round.forEach { it.length shouldBe Neighbourhood.ZOOM }

        Neighbourhood.round(Point(85.0, 0.0)) shouldHaveSize 6
    }
})
