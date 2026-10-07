package villages.application.fate

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.Location

/** The river a player points at, from the master's ground and its real names. See decision record 0087. */
class RiverAtSpec : StringSpec({
    // 360 by 180 cells, a degree each, all land, and a river down the column from 20 to 21 east.
    val cells = ByteArray(360 * 180 * 2)
    for (y in 0 until 180) cells[(y * 360 + 200) * 2 + 1] = GroundMap.RIVER.toByte()
    val ground = GroundMap(360, 180, mapOf(0 to "grassland"), cells)
    val vistula = PlaceName(
        "Q548", NameKind.RIVER, "Vistula", "Wisła", null, null, false, Location(52.0, 20.5), Location(52.0, 20.5),
        listOf(listOf(Location(51.0, 20.5), Location(53.0, 20.5))),
    )
    val names = PlaceNames(listOf(vistula), emptyList(), 0, 0, ShortArray(0))

    "a river the ground shows is named by the named river close enough to be the one painted there" {
        val rivers = RiverAt({ ground }, { names })

        rivers.at("terrain", Location(52.0, 20.3)) shouldBe RiverHere(vistula)
    }

    "a river the ground shows with no named river near is a river all the same, and where it shows none there is none" {
        val rivers = RiverAt({ ground }, { names })

        rivers.at("terrain", Location(10.0, 20.5)) shouldBe RiverHere(null)
        rivers.at("terrain", Location(52.0, 22.5)) shouldBe null
        RiverAt({ ground }, { null }).at("terrain", Location(52.0, 20.3)) shouldBe RiverHere(null)
        RiverAt.NOWHERE.at("terrain", Location(52.0, 20.3)) shouldBe null
    }
})
