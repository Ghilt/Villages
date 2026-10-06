package villages.application.fate

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import villages.application.HouseRow
import villages.application.Sight
import villages.application.SightChange
import villages.application.SightsByHouse
import villages.application.VisionPoint
import villages.application.VisionSource
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Significance
import villages.domain.Tincture
import villages.domain.WorldTime
import villages.domain.foundingStocks
import java.time.Instant
import java.util.UUID

/**
 * Where the player is looking, read off a ground map of one-degree cells: forest with a river through it east of
 * the seat, the sea west of it, and the fog over everything the seat's circle has not reached. See decision 0084.
 */
class MapOmensSpec : StringSpec({
    val today = WorldTime(454901)
    fun houseAt(player: PlayerId, name: String, at: Location) = HouseRow(
        HouseId.of(player), player, HouseName(name), at, Significance(20.0),
        Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
        resources = foundingStocks(Instant.EPOCH), pledges = emptyList(), since = today, until = null, version = 1,
    )
    val seat = Location(10.5, 20.5)
    val ours = houseAt(PlayerId(UUID.randomUUID()), "Ravenscar", seat)
    val neighbour = houseAt(PlayerId(UUID.randomUUID()), "Varga", Location(10.5, 21.5))

    // 360 by 180 cells, a degree each: ocean, but a block of forest from 20 east with a river down its middle
    // column, and a coast along its west edge.
    val classes = mapOf(0 to "ocean", 3 to "river", 10 to "broadleaf-forest")
    val cells = ByteArray(360 * 180 * 2) { at -> if (at % 2 == 1) GroundMap.SEA.toByte() else 0 }
    for (y in 70 until 90) for (x in 200 until 230) {
        val at = (y * 360 + x) * 2
        cells[at] = 10
        cells[at + 1] = when (x) {
            200 -> (GroundMap.COAST or GroundMap.SEA).toByte()
            205 -> GroundMap.RIVER.toByte()
            else -> 0
        }
    }
    val map = GroundMap(360, 180, classes, cells)
    val sightOf = { km: Double ->
        object : SightsByHouse {
            override fun of(house: HouseId) =
                Sight(house, listOf(VisionPoint(VisionSource.Seat, seat, km, today, null)))

            override fun watch(listener: (SightChange) -> Unit) = AutoCloseable {}
        }
    }
    fun omens(centre: Location, zoom: Double, seenKm: Double = 2000.0) =
        MapOmens({ map }, sightOf(seenKm)) { _, _, _ -> listOf(ours, neighbour) }
            .read(Moment(ours, Looking(centre = centre, zoom = zoom, master = "terrain"), today))
            .map { it.words }

    "the looking circle is as wide as a window shows at the zoom, and narrower towards the poles" {
        MapOmens.radiusAt(5.0, 0.0) shouldBe (640 * 156.543 / 32).plusOrMinus(0.01)
        MapOmens.radiusAt(5.0, 60.0) shouldBe (640 * 156.543 / 32 / 2).plusOrMinus(0.01)
        MapOmens.radiusAt(20.0, 0.0) shouldBe MapOmens.LEAST_KM
    }

    "zoomed out over the forest, the circle reads the coast and the forest, and no river and no house by name" {
        val read = omens(Location(12.0, 23.0), 4.0)

        read shouldContain "Coast"
        read shouldContain "Forest"
        read shouldNotContain "River"
        read shouldNotContain "House Varga"
    }

    "closer in, a river running through the circle is an omen" {
        omens(Location(12.0, 25.0), 8.0) shouldContain "River"
    }

    "zoomed in beside the seat, a house standing in the circle is an omen by name, and its own is not" {
        val read = omens(Location(10.5, 21.0), 10.0)

        read shouldContain "House Varga"
        read shouldNotContain "House Ravenscar"
    }

    "out over nothing but sea, it is the open sea" {
        omens(Location(10.0, -30.0), 7.0, seenKm = 8000.0) shouldBe listOf("Open sea")
    }

    "where the house has revealed nothing, it is Unknown and nothing else" {
        omens(Location(-40.0, 120.0), 7.0, seenKm = 50.0) shouldBe listOf("Unknown")
    }

    "a page with no master, or no view, reads nothing of the map" {
        MapOmens({ null }, sightOf(2000.0)) { _, _, _ -> emptyList() }
            .read(Moment(ours, Looking(centre = seat, zoom = 6.0, master = "none"), today)) shouldBe emptyList()
    }
})
