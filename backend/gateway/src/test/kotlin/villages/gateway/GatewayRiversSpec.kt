package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.application.fate.GroundMap
import villages.application.fate.NameKind
import villages.application.fate.PlaceName
import villages.application.fate.PlaceNames
import villages.domain.Location
import villages.protocol.Inspected
import villages.protocol.Point
import villages.protocol.RiverView

/** A master of a degree a cell, all land, with a river down the column Stockholm stands in, 18 to 19 east. */
private fun riverThroughStockholm(): GroundMap {
    val cells = ByteArray(360 * 180 * 2)
    for (y in 0 until 180) cells[(y * 360 + 198) * 2 + 1] = GroundMap.RIVER.toByte()
    return GroundMap(360, 180, mapOf(0 to "grassland"), cells)
}

/** Norrström, by its Wikidata id, running north and south through Stockholm. */
private val norrstrom = PlaceName(
    "Q1052063", NameKind.RIVER, "Norrström", null, null, null, false, Location(59.33, 18.07), Location(59.33, 18.07),
    listOf(listOf(Location(59.0, 18.07), Location(59.6, 18.07))),
)

/** The gateway: what river a page points at, named only on revealed ground. The rig is GatewayRig.kt. */
class GatewayRiversSpec : StringSpec({

    "a river pointed at on ground the house has revealed is named from the master the page draws" {
        val rig = Rig()
        rig.grounds["terrain"] = riverThroughStockholm()
        rig.names["terrain"] = PlaceNames(listOf(norrstrom), emptyList(), 0, 0, ShortArray(0))
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        sent.clear()

        mine.receive(inspectAt(59.33, 18.07))

        sent.filterIsInstance<Inspected>().single() shouldBe
            Inspected(Point(59.33, 18.07), revealed = true, river = RiverView("Q1052063", "Norrström"))
    }

    "under the fog nothing is named, and with the fog lifted the ground says whether there is a river at all" {
        val rig = Rig()
        rig.grounds["terrain"] = riverThroughStockholm()
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        sent.clear()

        mine.receive(inspectAt(HELSINKI_LAT, HELSINKI_LON))
        sent.filterIsInstance<Inspected>().single() shouldBe Inspected(Point(HELSINKI_LAT, HELSINKI_LON), false, null)
        sent.clear()

        mine.receive(fogOfWar(false))
        mine.receive(inspectAt(HELSINKI_LAT, HELSINKI_LON))
        mine.receive(inspectAt(59.33, 18.07))
        sent.filterIsInstance<Inspected>() shouldBe listOf(
            Inspected(Point(HELSINKI_LAT, HELSINKI_LON), revealed = true, river = null),
            // The ground shows a river with no named one near enough to be it: a river all the same.
            Inspected(Point(59.33, 18.07), revealed = true, river = RiverView()),
        )
    }

    "a page that draws no master points at no river, and a place off the Earth is not revealed" {
        val rig = Rig()
        rig.grounds["terrain"] = riverThroughStockholm()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        sent.clear()

        mine.receive(inspectAt(59.33, 18.07))
        mine.receive(inspectAt(95.0, 18.07))

        sent.filterIsInstance<Inspected>() shouldBe listOf(
            Inspected(Point(59.33, 18.07), revealed = true, river = null),
            Inspected(Point(95.0, 18.07), revealed = false, river = null),
        )
    }
})
