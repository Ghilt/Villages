package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.application.fate.GroundMap
import villages.application.fate.NameKind
import villages.application.fate.NamedRegion
import villages.application.fate.PlaceName
import villages.application.fate.PlaceNames
import villages.application.fate.RegionKind
import villages.domain.Location
import villages.protocol.InspectedAt
import villages.protocol.Point
import villages.protocol.WaterView
import villages.protocol.YourChoice

/**
 * A master of a degree a cell, all land, with a river down the column Stockholm stands in, 18 to 19 east; a lake in
 * the cell west of it on the 59th parallel, where Lake Maeler is; and the sea from 19 east to 21.
 */
private fun watersAboutStockholm(): GroundMap {
    val cells = ByteArray(360 * 180 * 2)
    for (y in 0 until 180) {
        cells[(y * 360 + 198) * 2 + 1] = GroundMap.RIVER.toByte()
        for (x in 199..200) {
            cells[(y * 360 + x) * 2] = 1
            cells[(y * 360 + x) * 2 + 1] = GroundMap.SEA.toByte()
        }
    }
    cells[(30 * 360 + 197) * 2 + 1] = GroundMap.LAKE.toByte()
    return GroundMap(360, 180, mapOf(0 to "grassland", 1 to "ocean"), cells)
}

/** Norrström, by its Wikidata id, running north and south through Stockholm. */
private val norrstrom = PlaceName(
    "Q1052063", NameKind.RIVER, "Norrström", null, null, null, false, Location(59.33, 18.07), Location(59.33, 18.07),
    listOf(listOf(Location(59.0, 18.07), Location(59.6, 18.07))),
)

/** Lake Maeler, as an English writer of 1790 had Mälaren, drawn as a box west of Stockholm, with a line about it. */
private val maeler = PlaceName(
    "Q211967", NameKind.LAKE, "Lake Maeler", "Mälaren", null, null, true, Location(59.35, 17.6), Location(59.35, 17.6),
    listOf(listOf(59.2 to 17.3, 59.2 to 17.95, 59.5 to 17.95, 59.5 to 17.3, 59.2 to 17.3).map { Location(it.first, it.second) }),
    about = "The long lake behind Stockholm.",
)

/** Every square of the world by the Baltic, which is enough for a sea east of Stockholm. */
private val names = PlaceNames(
    listOf(norrstrom, maeler), listOf(NamedRegion("Q545", RegionKind.SEA, "Baltic Sea", "sea")), 1, 1, shortArrayOf(0, 1),
)

/** The gateway: what water a page points at, named only on revealed ground. The rig is GatewayRig.kt. */
class GatewayWatersSpec : StringSpec({

    "a river, a lake and the sea pointed at on ground the house has revealed are named from the master the page draws" {
        val rig = Rig()
        rig.grounds["terrain"] = watersAboutStockholm()
        rig.names["terrain"] = names
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        sent.clear()

        mine.receive(inspectAt(59.33, 18.07))
        mine.receive(inspectAt(59.35, 17.6))
        mine.receive(inspectAt(59.33, 19.2))

        sent.filterIsInstance<InspectedAt>() shouldBe listOf(
            InspectedAt(Point(59.33, 18.07), revealed = true, water = WaterView("river", "Q1052063", "Norrström")),
            InspectedAt(
                Point(59.35, 17.6),
                revealed = true,
                water = WaterView("lake", "Q211967", "Lake Maeler", "Mälaren", true, "The long lake behind Stockholm."),
            ),
            // Sixty-four kilometres out from a seat that sees thirty-four: the fog's.
            InspectedAt(Point(59.33, 19.2), revealed = false, water = null),
        )
    }

    "under the fog nothing is named, and with the fog lifted the ground says whether there is water at all" {
        val rig = Rig()
        rig.grounds["terrain"] = watersAboutStockholm()
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        sent.clear()

        mine.receive(inspectAt(HELSINKI_LAT, HELSINKI_LON))
        sent.filterIsInstance<InspectedAt>().single() shouldBe InspectedAt(Point(HELSINKI_LAT, HELSINKI_LON), false, null)
        sent.clear()

        mine.receive(fogOfWar(false))
        mine.receive(inspectAt(HELSINKI_LAT, HELSINKI_LON))
        mine.receive(inspectAt(59.33, 18.07))
        rig.names["terrain"] = names
        mine.receive(inspectAt(59.33, 19.2))
        sent.filterIsInstance<InspectedAt>() shouldBe listOf(
            InspectedAt(Point(HELSINKI_LAT, HELSINKI_LON), revealed = true, water = null),
            // The ground shows a river with no named one near enough to be it: a river all the same.
            InspectedAt(Point(59.33, 18.07), revealed = true, water = WaterView("river")),
            InspectedAt(Point(59.33, 19.2), revealed = true, water = WaterView("sea", "Q545", "Baltic Sea")),
        )
    }

    "a roll reads the windows open on water as omens, by the server's names, and drops what the house has not revealed" {
        val rig = Rig()
        rig.grounds["terrain"] = watersAboutStockholm()
        rig.names["terrain"] = names
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())

        // Two windows on Norrström, one on Lake Maeler, one on the sea out past the fog, and one off the Earth.
        val places = listOf(59.33 to 18.07, 59.35 to 17.6, 59.4 to 18.07, 59.33 to 19.2, 95.0 to 18.07)
        mine.receive(
            """{"type":"command","commandId":"$COMMAND_TWO","command":{"type":"roll","inspectingWaters":[""" +
                places.joinToString(",") { (lat, lon) -> """{"lat":$lat,"lon":$lon}""" } + "]}}",
        )

        sent.filterIsInstance<YourChoice>().last().choice!!.omens.map { it.words } shouldBe listOf(
            "Holdings in the northern reaches",
            "Weak house",
            "Inspecting the Norrström",
            "Inspecting Lake Maeler",
            "Summer",
        )
    }

    "a page that draws no master points at no water, and a place off the Earth is not revealed" {
        val rig = Rig()
        rig.grounds["terrain"] = watersAboutStockholm()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        sent.clear()

        mine.receive(inspectAt(59.33, 18.07))
        mine.receive(inspectAt(95.0, 18.07))

        sent.filterIsInstance<InspectedAt>() shouldBe listOf(
            InspectedAt(Point(59.33, 18.07), revealed = true, water = null),
            InspectedAt(Point(95.0, 18.07), revealed = false, water = null),
        )
    }
})
