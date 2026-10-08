package villages.application.fate

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.Location

/** The water a player points at, from the master's ground and its real names. See decision record 0087. */
class WaterAtSpec : StringSpec({
    // 360 by 180 cells, a degree each, all land but for a river down the column from 20 to 21 east, a lake from 8 to
    // 10 east on the 46th parallel, and the sea west of nought, its first column a shore.
    val cells = ByteArray(360 * 180 * 2)
    fun mark(x: Int, y: Int, terrain: Int, marks: Int) {
        cells[(y * 360 + x) * 2] = terrain.toByte()
        cells[(y * 360 + x) * 2 + 1] = marks.toByte()
    }
    for (y in 0 until 180) {
        mark(200, y, 0, GroundMap.RIVER)
        for (x in 0 until 179) mark(x, y, 1, GroundMap.SEA)
        mark(179, y, 0, GroundMap.SEA or GroundMap.COAST)
    }
    for (x in 188..189) mark(x, 43, 0, GroundMap.LAKE)
    val ground = GroundMap(360, 180, mapOf(0 to "grassland", 1 to "ocean"), cells)

    val vistula = PlaceName(
        "Q548", NameKind.RIVER, "Vistula", "Wisła", null, null, false, Location(52.0, 20.5), Location(52.0, 20.5),
        listOf(listOf(Location(51.0, 20.5), Location(53.0, 20.5))),
    )
    // The Lake of Geneva drawn as a box from 8 to 10 east, with an island in its east end.
    val geneva = PlaceName(
        "Q6403", NameKind.LAKE, "Lake of Geneva", "Lake Geneva", null, null, true, Location(46.4, 9.0),
        Location(46.4, 6.5),
        listOf(
            listOf(46.1 to 8.0, 46.1 to 10.0, 46.9 to 10.0, 46.9 to 8.0, 46.1 to 8.0).map { Location(it.first, it.second) },
            listOf(46.4 to 9.6, 46.4 to 9.9, 46.6 to 9.9, 46.6 to 9.6, 46.4 to 9.6).map { Location(it.first, it.second) },
        ),
    )
    val atlantic = NamedRegion("Q97", RegionKind.SEA, "Western Ocean", "ocean", "Atlantic Ocean", of1790 = true)
    // One square for the whole world: no named land, and the Western Ocean by it.
    val names = PlaceNames(listOf(vistula, geneva), listOf(atlantic), 1, 1, shortArrayOf(0, 1))
    val waters = WaterAt({ ground }, { names })

    "a river the ground shows is named by the named river close enough to be the one painted there" {
        waters.at("terrain", Location(52.0, 20.3)) shouldBe
            WaterHere(WaterKind.RIVER, "Q548", "Vistula", "Wisła", lines = vistula.lines)
    }

    "a lake is named by the shores the place lies inside, and an island in it by the nearest shore of the lake's cell" {
        val lake = WaterHere(WaterKind.LAKE, "Q6403", "Lake of Geneva", "Lake Geneva", of1790 = true, lines = geneva.lines)
        waters.at("terrain", Location(46.3, 8.5)) shouldBe lake
        names.inside(NameKind.LAKE, Location(46.5, 9.7)) shouldBe null
        waters.at("terrain", Location(46.5, 9.7)) shouldBe lake
    }

    "the sea is named by the sea the place is in or by, and a shore that is mostly land is the sea where it holds no other water" {
        waters.at("terrain", Location(30.0, -40.0)) shouldBe
            WaterHere(WaterKind.SEA, "Q97", "Western Ocean", "Atlantic Ocean", of1790 = true)
        waters.at("terrain", Location(30.0, -0.5)) shouldBe
            WaterHere(WaterKind.SEA, "Q97", "Western Ocean", "Atlantic Ocean", of1790 = true)
    }

    "water the ground shows with nothing named near is water all the same, and where it shows none there is none" {
        waters.at("terrain", Location(10.0, 20.5)) shouldBe WaterHere(WaterKind.RIVER)
        waters.at("terrain", Location(52.0, 22.5)) shouldBe null
        WaterAt({ ground }, { null }).at("terrain", Location(52.0, 20.3)) shouldBe WaterHere(WaterKind.RIVER)
        WaterAt({ ground }, { null }).at("terrain", Location(46.3, 8.5)) shouldBe WaterHere(WaterKind.LAKE)
        WaterAt({ ground }, { null }).at("terrain", Location(30.0, -40.0)) shouldBe WaterHere(WaterKind.SEA)
        WaterAt.NOWHERE.at("terrain", Location(52.0, 20.3)) shouldBe null
    }

    "a river's course is every piece of it under its name joined to the one pointed at, and a lake's its shores" {
        // The Vistula in three pieces, the third far off in another land; and a river of another name across it.
        fun piece(id: String, name: String, vararg run: Pair<Double, Double>) = PlaceName(
            id, NameKind.RIVER, name, null, null, null, false, Location(52.0, 20.5), Location(52.0, 20.5),
            listOf(run.map { Location(it.first, it.second) }),
        )
        val upper = piece("ne:1:Wisla", "Vistula", 49.5 to 20.5, 51.0 to 20.5)
        val lower = piece("Q548", "Vistula", 51.1 to 20.5, 53.0 to 20.5)
        val elsewhere = piece("ne:2:Wisla", "Vistula", 30.0 to 20.5, 31.0 to 20.5)
        val across = piece("ne:3:Pilica", "Pilica", 51.5 to 19.0, 51.5 to 20.5)
        val pieces = PlaceNames(listOf(upper, lower, elsewhere, across, geneva), emptyList(), 0, 0, ShortArray(0))
        val found = WaterAt({ ground }, { pieces })

        found.at("terrain", Location(52.0, 20.3))!!.lines shouldBe lower.lines + upper.lines
        found.at("terrain", Location(46.3, 8.5))!!.lines shouldBe geneva.lines
        waters.at("terrain", Location(30.0, -40.0))!!.lines shouldBe emptyList()
    }
})
