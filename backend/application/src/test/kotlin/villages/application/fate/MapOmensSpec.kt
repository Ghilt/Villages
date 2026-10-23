package villages.application.fate

import villages.application.TEST_BALANCE
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotContain
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
import villages.domain.VisionId

private val A_CASTLE = VisionId(UUID.fromString("dd000000-0000-4000-8000-0000000000ca"))

/**
 * Where the player is looking, read off a ground map of one-degree cells: forest with a river through it east of
 * the seat, the sea west of it, and the fog over everything the seat's circle has not reached; and, where the
 * master's real names were carried, what the river, the sea and the towns are called. See decisions 0084 and 0087.
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
                Sight(house, listOf(VisionPoint(VisionSource.Given(A_CASTLE), seat, km, today, null)))

            override fun watch(listener: (SightChange) -> Unit) = AutoCloseable {}
        }
    }
    fun omensOf(landing: Location, circleKm: Double, seenKm: Double = 2000.0, named: PlaceNames? = null) =
        MapOmens({ map }, sightOf(seenKm), houses = { _, _, _ -> listOf(ours, neighbour) }, names = { named }) { TEST_BALANCE }
            .read(Moment(ours, Looking(landing = landing, master = "terrain"), today, Instant.EPOCH, circleKm))
    fun omens(landing: Location, circleKm: Double, seenKm: Double = 2000.0) =
        omensOf(landing, circleKm, seenKm).map { it.words }

    // The names: a river down the painted one's column, a town of 1790 beside the seat and one far off in the
    // fog, and every square of the map by one named sea.
    fun town(id: String, name: String, at: Location) =
        PlaceName(id, NameKind.TOWN, name, null, 5.0, null, true, at, at, emptyList())
    val ister = PlaceName(
        "Q1", NameKind.RIVER, "Ister", "Danube", 3.0, null, false, Location(10.0, 25.5), Location(45.2, 29.6),
        listOf(listOf(Location(0.5, 25.5), Location(19.5, 25.5))),
    )
    val tomis = town("Q2", "Tomis", Location(10.6, 21.2))
    val olbia = town("Q3", "Olbia", Location(-40.0, 120.0))
    val euxine = NamedRegion("Q4", RegionKind.SEA, "Euxine Sea", "sea")
    val squares = 360 * 180
    val named = PlaceNames(
        listOf(ister, tomis, olbia), listOf(euxine), 360, 180,
        ShortArray(squares * 2).also { it.fill(1, squares, squares * 2) },
    )

    "the circle round the landing is as wide as the moment says, whatever the page was zoomed to" {
        omens(Location(10.5, 21.0), 100.0) shouldContain "House Varga"
        omens(Location(10.5, 21.0), 1500.0) shouldNotContain "House Varga"
    }

    "a circle narrower than a cell still reads the ground under the landing, where the house has revealed it" {
        // A degree a cell, so a circle of five kilometres holds no cell's middle.
        omens(Location(12.3, 23.3), 5.0) shouldContain "Forest"
        omens(Location(-40.3, 120.3), 5.0, seenKm = 50.0) shouldBe listOf("Unknown")
    }

    "a wide circle over the forest reads the coast and the forest, and no river and no house by name" {
        val read = omens(Location(12.0, 23.0), 6000.0)

        read shouldContain "Coast"
        read shouldContain "Forest"
        read shouldNotContain "River"
        read shouldNotContain "House Varga"
    }

    "in a narrower circle, a river running through it is an omen" {
        omens(Location(12.0, 25.0), 380.0) shouldContain "River"
    }

    "landed beside the seat, a house standing in the circle is an omen by name, and its own is not" {
        val read = omens(Location(10.5, 21.0), 100.0)

        read shouldContain "House Varga"
        read shouldNotContain "House Ravenscar"
    }

    "out over nothing but sea, it is the open sea" {
        omens(Location(10.0, -30.0), 750.0, seenKm = 8000.0) shouldBe listOf("Open sea")
    }

    "where the house has revealed nothing, it is Unknown and nothing else" {
        omens(Location(-40.0, 120.0), 750.0, seenKm = 50.0) shouldBe listOf("Unknown")
    }

    "a page with no master, or a roll that landed nowhere, reads nothing of the map" {
        MapOmens({ null }, sightOf(2000.0), houses = { _, _, _ -> emptyList() }) { TEST_BALANCE }
            .read(Moment(ours, Looking(landing = seat, master = "none"), today, Instant.EPOCH, 25.0)) shouldBe emptyList()
        MapOmens({ map }, sightOf(2000.0), houses = { _, _, _ -> emptyList() }) { TEST_BALANCE }
            .read(Moment(ours, Looking(master = "terrain"), today, Instant.EPOCH, 25.0)) shouldBe emptyList()
    }

    "a river the names know is the omen by its name, under a river's own key, so it opens what a river opens" {
        omensOf(Location(12.0, 25.0), 380.0, named = named).single { it.key == OmenKeys.RIVER }.words shouldBe "The Ister"
    }

    "out over the open sea, the sea is the omen by its name, under the open sea's own key" {
        omensOf(Location(10.0, -30.0), 750.0, seenKm = 8000.0, named = named).map { it.key to it.words } shouldBe
            listOf(OmenKeys.OPEN_SEA to "The Euxine Sea")
    }

    "landed close, a town of 1790 in the revealed circle is an omen by its name and its own key" {
        omensOf(Location(10.5, 21.0), 100.0, named = named).single { it.key == OmenKeys.town("Q2") }.words shouldBe
            "Near Tomis"
    }

    "a town the house has not revealed is no omen, and nor is one when the circle is wider than the houses'" {
        omensOf(Location(10.5, 21.0), 100.0, seenKm = 10.0, named = named).map { it.key } shouldNotContain
            OmenKeys.town("Q2")
        omensOf(Location(10.5, 21.0), 1500.0, named = named).map { it.key } shouldNotContain OmenKeys.town("Q2")
    }
})
