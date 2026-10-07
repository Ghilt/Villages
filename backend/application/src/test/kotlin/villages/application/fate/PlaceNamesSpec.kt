package villages.application.fate

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import villages.domain.Location
import kotlin.math.cos

/** The questions the server asks of a master's real names. See decision record 0087. */
class PlaceNamesSpec : StringSpec({
    fun river(id: String, vararg points: Location) = PlaceName(
        id, NameKind.RIVER, id, null, null, null, false, points.first(), points.first(), listOf(points.toList()),
    )
    fun town(id: String, at: Location) = PlaceName(id, NameKind.TOWN, id, null, null, null, true, at, at, emptyList())

    "a river is as near as the nearest stretch of its line, a town as its point, and the nearest comes first" {
        val names = PlaceNames(
            listOf(
                river("Narew", Location(52.0, 20.0), Location(53.0, 20.0)),
                river("Bug", Location(51.0, 21.0), Location(54.0, 21.0)),
                town("Plock", Location(52.5, 19.7)),
            ),
            emptyList(), 0, 0, ShortArray(0),
        )

        val rivers = names.near(NameKind.RIVER, Location(52.5, 20.2), 100.0)
        rivers.map { it.name.id } shouldBe listOf("Narew", "Bug")
        rivers[0].km shouldBe (0.2 * 111.32 * cos(Math.toRadians(52.5))).plusOrMinus(0.01)
        names.near(NameKind.RIVER, Location(52.5, 20.2), 20.0).map { it.name.id } shouldBe listOf("Narew")
        names.near(NameKind.TOWN, Location(52.5, 20.2), 100.0).single().km shouldBe
            kmBetween(Location(52.5, 20.2), Location(52.5, 19.7))
    }

    "a river beside the date line is found from the other side of it" {
        val anadyr = river("Anadyr", Location(0.0, 179.5), Location(0.0, 179.9))
        val names = PlaceNames(listOf(anadyr), emptyList(), 0, 0, ShortArray(0))

        names.near(NameKind.RIVER, Location(0.0, -179.9), 50.0).single().km shouldBe (0.2 * 111.32).plusOrMinus(0.01)
    }

    "every square has the land it is in and the sea it is by, from one layer each, and a kind that does not match is none" {
        val baltic = NamedRegion("Q545", RegionKind.SEA, "Baltic Sea", "sea")
        val pomerania = NamedRegion("Pomerania", RegionKind.LAND, "Pomerania", "Region")
        // Four squares across and two down: the north-east in Pomerania, and both northern quarters east of the
        // meridian by the Baltic.
        val layers = shortArrayOf(0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0)
        val names = PlaceNames(emptyList(), listOf(baltic, pomerania), 4, 2, layers)

        names.regionAt(Location(45.0, 45.0), RegionKind.LAND) shouldBe pomerania
        names.regionAt(Location(45.0, 45.0), RegionKind.SEA) shouldBe baltic
        names.regionAt(Location(45.0, 135.0), RegionKind.LAND) shouldBe null
        names.regionAt(Location(45.0, 135.0), RegionKind.SEA) shouldBe baltic
        names.regionAt(Location(-45.0, -135.0), RegionKind.SEA) shouldBe null
        PlaceNames(emptyList(), listOf(baltic), 4, 2, shortArrayOf(1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0))
            .regionAt(Location(45.0, -135.0), RegionKind.LAND) shouldBe null
    }
})
