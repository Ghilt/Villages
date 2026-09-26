package villages.projections

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import villages.application.EventFeed
import villages.application.SightChange
import villages.application.Start
import villages.application.StoredEvent
import villages.application.VisionPoint
import villages.application.VisionSource
import villages.domain.Banner
import villages.domain.CharacterDied
import villages.domain.CharacterId
import villages.domain.CharacterLeftTheMap
import villages.domain.CharacterMoved
import villages.domain.CharacterStatChanged
import villages.domain.Charge
import villages.domain.Division
import villages.domain.Event
import villages.domain.HouseFounded
import villages.domain.HouseGainedKeyFigure
import villages.domain.HouseId
import villages.domain.HouseLostKeyFigure
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Significance
import villages.domain.Stat
import villages.domain.Tincture
import villages.domain.WorldTime
import villages.domain.emptyStocks
import java.time.Instant
import java.util.UUID

/** A feed that delivers whatever it is handed, of either kind of stream, the moment it is handed it. */
private class HandFedSightEvents : EventFeed {
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    fun deliver(event: Event) {
        val stored = StoredEvent(
            id = UUID.randomUUID().toString(),
            type = event::class.simpleName!!,
            stream = "whatever",
            streamVersion = 1,
            time = event.recordedAt,
            data = "{}",
            correlationId = UUID.randomUUID().toString(),
            causationId = UUID.randomUUID().toString(),
            event = event,
        )
        subscribers.toList().forEach { it(stored) }
    }
}

class SightProjectionSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val founding = WorldTime(653_705)
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val bea = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8e"))
    val adas = HouseId.of(ada)
    val beas = HouseId.of(bea)
    val sable = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT)
    val stockholm = Location(59.33, 18.07)
    val uppsala = Location(59.86, 17.64)
    val visby = Location(57.64, 18.30)

    fun figure(n: Int) = CharacterId(UUID.fromString("cc000000-0000-4000-8000-%012d".format(n)))
    fun founded(player: PlayerId, seat: Location = stockholm, on: WorldTime = founding) = HouseFounded(
        HouseId.of(player), player, HouseName("Ravenscar"), seat, Significance(20.0), sable,
        emptyStocks(noon), on, noon,
    )
    fun moved(n: Int, to: Location, on: WorldTime) = CharacterMoved(figure(n), to, Significance(10.0), on, noon)
    fun seat(at: Location = stockholm, since: WorldTime = founding) =
        VisionPoint(VisionSource.Seat, at, VisionPoint.MALLORCA, since, until = null)
    fun standing(n: Int, at: Location, since: WorldTime, until: WorldTime? = null) =
        VisionPoint(VisionSource.KeyFigure(figure(n)), at, VisionPoint.MALLORCA, since, until)

    "a house that does not exist sees nothing" {
        SightProjection(HandFedSightEvents()).of(adas).points.shouldBeEmpty()
    }

    "a founded house sees from its seat, from the day it was founded, for as big a circle as Mallorca" {
        val feed = HandFedSightEvents()
        val sights = SightProjection(feed)

        feed.deliver(founded(ada))

        sights.of(adas).points shouldContainExactly listOf(seat())
        sights.of(adas).visionOn(founding + 1) shouldContainExactly listOf(seat())
        VisionPoint.MALLORCA shouldBe 34.0
    }

    "a key figure standing somewhere gives the house vision there, from the day they became its" {
        val feed = HandFedSightEvents()
        val sights = SightProjection(feed)
        feed.deliver(founded(ada))

        // Standing in Uppsala before anyone took them in: what they saw then was nobody's.
        feed.deliver(moved(1, uppsala, founding + 2))
        feed.deliver(HouseGainedKeyFigure(adas, figure(1), founding + 5, noon))

        sights.of(adas).points shouldContainExactly listOf(seat(), standing(1, uppsala, founding + 5))
    }

    "a key figure on no map gives no vision until they are put somewhere" {
        val feed = HandFedSightEvents()
        val sights = SightProjection(feed)
        feed.deliver(founded(ada))
        feed.deliver(HouseGainedKeyFigure(adas, figure(1), founding + 1, noon))

        sights.of(adas).points shouldContainExactly listOf(seat())

        feed.deliver(moved(1, visby, founding + 3))

        sights.of(adas).points shouldContainExactly listOf(seat(), standing(1, visby, founding + 3))
    }

    "a move closes the point a key figure stood at and opens the next, and the closed one is still revealed" {
        val feed = HandFedSightEvents()
        val sights = SightProjection(feed)
        feed.deliver(founded(ada))
        feed.deliver(HouseGainedKeyFigure(adas, figure(1), founding, noon))
        feed.deliver(moved(1, uppsala, founding + 1))

        feed.deliver(moved(1, visby, founding + 4))

        val sight = sights.of(adas)
        sight.points shouldContainExactly listOf(
            seat(),
            standing(1, uppsala, founding + 1, until = founding + 4),
            standing(1, visby, founding + 4),
        )
        // Vision is what lasts; what ended is revealed and no longer seen.
        sight.visionOn(founding + 4) shouldContainExactly listOf(seat(), standing(1, visby, founding + 4))
    }

    "two moves on one day still reveal the place stood at in between, for no time at all" {
        val feed = HandFedSightEvents()
        val sights = SightProjection(feed)
        feed.deliver(founded(ada))
        feed.deliver(HouseGainedKeyFigure(adas, figure(1), founding, noon))

        feed.deliver(moved(1, uppsala, founding + 1))
        feed.deliver(moved(1, visby, founding + 1))

        val sight = sights.of(adas)
        sight.points shouldHaveSize 3
        sight.visionOn(founding + 1) shouldContainExactly listOf(seat(), standing(1, visby, founding + 1))
    }

    "leaving the map, dying and being lost to the house each close the point a key figure gives" {
        val feed = HandFedSightEvents()
        val sights = SightProjection(feed)
        feed.deliver(founded(ada))
        for (n in 1..3) {
            feed.deliver(HouseGainedKeyFigure(adas, figure(n), founding, noon))
            feed.deliver(moved(n, uppsala, founding))
        }

        feed.deliver(CharacterLeftTheMap(figure(1), founding + 2, noon))
        feed.deliver(CharacterDied(figure(2), "a fever", founding + 3, noon))
        feed.deliver(HouseLostKeyFigure(adas, figure(3), founding + 4, noon))

        sights.of(adas).points shouldContainExactly listOf(
            seat(),
            standing(1, uppsala, founding, until = founding + 2),
            standing(2, uppsala, founding, until = founding + 3),
            standing(3, uppsala, founding, until = founding + 4),
        )
        sights.of(adas).visionOn(founding + 5) shouldContainExactly listOf(seat())
    }

    "one person serving two houses gives both of them vision, each from the day they took them in" {
        val feed = HandFedSightEvents()
        val sights = SightProjection(feed)
        feed.deliver(founded(ada))
        feed.deliver(founded(bea, seat = visby))
        feed.deliver(moved(1, uppsala, founding))
        feed.deliver(HouseGainedKeyFigure(adas, figure(1), founding + 1, noon))
        feed.deliver(HouseGainedKeyFigure(beas, figure(1), founding + 2, noon))

        sights.of(adas).points shouldContainExactly listOf(seat(), standing(1, uppsala, founding + 1))
        sights.of(beas).points shouldContainExactly listOf(seat(at = visby), standing(1, uppsala, founding + 2))
    }

    "every change is told to the player whose house it is, and what changes nothing is not told" {
        val feed = HandFedSightEvents()
        val sights = SightProjection(feed)
        val told = mutableListOf<SightChange>()
        sights.watch { told += it }

        feed.deliver(founded(ada))
        feed.deliver(HouseGainedKeyFigure(adas, figure(1), founding, noon))
        feed.deliver(CharacterStatChanged(figure(1), Stat.PIETY, 12, founding, noon))
        feed.deliver(moved(1, uppsala, founding + 1))

        told.map { it.player } shouldContainExactly listOf(ada, ada)
        told.last().sight.points shouldContainExactly listOf(seat(), standing(1, uppsala, founding + 1))
    }

    "a wiped world forgets every house's sight" {
        val feed = HandFedSightEvents()
        val sights = SightProjection(feed)
        feed.deliver(founded(ada))

        sights.reset()

        sights.of(adas).points.shouldBeEmpty()
    }
})
