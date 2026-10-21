package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.ints.shouldBeLessThan
import io.kotest.matchers.shouldBe
import villages.protocol.Cell
import villages.protocol.Snapshot
import villages.protocol.StandRecords
import villages.protocol.StandsFrame
import villages.protocol.YourSight
import villages.protocol.STAND_TILES
import java.util.Base64
import java.util.UUID
import kotlin.math.PI
import kotlin.math.ln
import kotlin.math.roundToInt
import kotlin.math.tan

/** How far across the scenery's world a place is, in world units: the Mercator square, 32768 a side. */
private fun worldX(lon: Double): Double = (lon + 180.0) / 360.0 * 32768.0

/** How far down the scenery's world a place is, in world units. */
private fun worldY(lat: Double): Double = (0.5 - ln(tan(PI / 4.0 + lat * PI / 360.0)) / (2.0 * PI)) * 32768.0

/** The zoom 7 tile Stockholm is in, 70 across and 37 down, and one stand there as the sprite map writes it. */
private const val STOCKHOLM_TILE = 37 * STAND_TILES + 70

private fun stockholmStand(eastOfTheSeat: Double, reach: Double): ByteArray {
    val across = ((worldX(18.07) + eastOfTheSeat - 70 * 256) * 8).roundToInt()
    val down = ((worldY(59.33) - 37 * 256) * 8).roundToInt()
    return byteArrayOf(
        across.toByte(), (across shr 8).toByte(), down.toByte(), (down shr 8).toByte(), (reach * 4).roundToInt().toByte(),
        0, 40, 7,
    )
}

/** At the seat; just outside its circle, near enough to count; and a hundred units off, too far for its reach. */
private val atTheSeat = stockholmStand(0.0, 6.0)
private val justOutside = stockholmStand(60.0, 2.0)
private val farOff = stockholmStand(100.0, 6.0)

/** The records a stands frame carries, as bytes to compare. */
private fun recordsOf(frame: StandsFrame): List<Byte> = Base64.getDecoder().decode(frame.stands).toList()

/** The frames of one layer of the stands among what was sent: the scenery's unless said. */
private fun List<Any?>.standsOf(layer: String = "biome"): List<StandsFrame> =
    filterIsInstance<StandsFrame>().filter { it.layer == layer }

/** The gateway: the scenery's stands, sent as far as the fog lets them through. The rig is GatewayRig.kt. */
class GatewayStandsSpec : StringSpec({

    "a page drawing a master is sent the stands of the tile under a held cell, as far as they touch revealed ground" {
        val rig = Rig()
        rig.standsOnDisk[STOCKHOLM_TILE] = atTheSeat + justOutside + farOff
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        rig.settle()
        sent.clear()

        mine.receive(subscribe(STOCKHOLM_Z10))

        val stands = sent.standsOf().single()
        (stands.x to stands.y) shouldBe (70 to 37)
        recordsOf(stands) shouldBe (atTheSeat + justOutside).toList()
        // After the cell's own snapshot, which is what the page draws first.
        sent.indexOfFirst { it is Snapshot } shouldBeLessThan sent.indexOf(stands)
    }

    "the fog lifted sends every stand of a held tile, and falling again sends only what it lets through" {
        val rig = Rig()
        rig.standsOnDisk[STOCKHOLM_TILE] = atTheSeat + justOutside + farOff
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        rig.settle()
        mine.receive(subscribe(STOCKHOLM_Z10))
        sent.clear()

        mine.receive(fogOfWar(false))
        recordsOf(sent.standsOf().single()) shouldBe (atTheSeat + justOutside + farOff).toList()
        sent.clear()

        mine.receive(fogOfWar(true))
        recordsOf(sent.standsOf().single()) shouldBe (atTheSeat + justOutside).toList()
    }

    "vision given near a held tile sends it again with what it now reaches, and a sight change that alters it not sends nothing" {
        val rig = Rig()
        rig.standsOnDisk[STOCKHOLM_TILE] = atTheSeat + justOutside + farOff
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        rig.settle()
        mine.receive(subscribe(STOCKHOLM_Z10))
        sent.clear()

        // Over the far stand: a hundred units east of the seat on the map.
        mine.receive(givingVision(59.33, 18.07 + 100.0 / 32768.0 * 360.0, commandNumber(1)))
        recordsOf(sent.standsOf().single()) shouldBe (atTheSeat + justOutside + farOff).toList()
        sent.clear()

        mine.receive(givingVision(HELSINKI_LAT, HELSINKI_LON, commandNumber(2)))
        sent.filterIsInstance<YourSight>().shouldNotBeEmpty()
        sent.standsOf().shouldBeEmpty()
    }

    "a tile is sent once while any held cell is over it, and afresh once none is and one comes back" {
        val rig = Rig()
        rig.standsOnDisk[STOCKHOLM_TILE] = atTheSeat
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        rig.settle()
        val eastOfIt = Cell.of(59.33, 18.07 + 360.0 / 1024, 10).quadkey
        sent.clear()

        mine.receive(subscribe(STOCKHOLM_Z10, eastOfIt))
        sent.standsOf() shouldHaveSize 1
        sent.clear()

        mine.receive(unsubscribe(STOCKHOLM_Z10))
        mine.receive(subscribe(STOCKHOLM_Z10))
        sent.standsOf().shouldBeEmpty()

        mine.receive(unsubscribe(STOCKHOLM_Z10, eastOfIt))
        mine.receive(subscribe(STOCKHOLM_Z10))
        recordsOf(sent.standsOf().single()) shouldBe atTheSeat.toList()
    }

    "a tile nothing stands in is sent empty, so the page knows it has all there is" {
        val rig = Rig()
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        sent.clear()

        mine.receive(subscribe(STOCKHOLM_Z10))

        sent.standsOf().single().stands shouldBe ""
    }

    "a page that names no master is sent no stands, and one the folder has none of is sent every tile empty" {
        val rig = Rig()
        rig.standsOnDisk[STOCKHOLM_TILE] = atTheSeat
        val (nameless, toldNothing) = rig.introduced()
        nameless.receive(founding())
        toldNothing.clear()
        nameless.receive(subscribe(STOCKHOLM_Z10))
        toldNothing.standsOf().shouldBeEmpty()

        val (wrong, toldEmpty) = rig.introduced(token = UUID.randomUUID().toString(), master = "nowhere")
        wrong.receive(founding())
        toldEmpty.clear()
        wrong.receive(subscribe(STOCKHOLM_Z10))
        toldEmpty.standsOf().single().stands shouldBe ""
    }

    "a tile's ruins are sent beside its scenery, as far as the fog lets them through, and empty where there are none" {
        val rig = Rig()
        rig.standsOnDisk[STOCKHOLM_TILE] = atTheSeat
        rig.ruinsOnDisk[STOCKHOLM_TILE] = justOutside + farOff
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        rig.settle()
        sent.clear()

        mine.receive(subscribe(STOCKHOLM_Z10))

        recordsOf(sent.standsOf("biome").single()) shouldBe atTheSeat.toList()
        recordsOf(sent.standsOf("ruins").single()) shouldBe justOutside.toList()
        sent.filterIsInstance<StandsFrame>().map { it.layer }.toSet() shouldBe setOf("biome", "ruins", "roads", "settlements")

        rig.ruinsOnDisk.clear()
        val (other, toldOther) = rig.introduced(token = UUID.randomUUID().toString(), master = "terrain")
        other.receive(founding())
        toldOther.clear()
        other.receive(subscribe(STOCKHOLM_Z10))
        toldOther.standsOf("ruins").single().stands shouldBe ""
    }

    "a tile's roads are sent in pieces beside its ruins, a piece as far as the fog lets it through" {
        val rig = Rig()
        rig.roadsOnDisk[STOCKHOLM_TILE] = justOutside + farOff
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        rig.settle()
        sent.clear()

        mine.receive(subscribe(STOCKHOLM_Z10))

        // A piece is a middle and a reach to the fog, as a stand is: the one within reach goes, the far one does not.
        recordsOf(sent.standsOf("roads").single()) shouldBe justOutside.toList()
        sent.standsOf("ruins").single().stands shouldBe ""
    }

    "a tile's settlements are sent beside its roads, a settlement as far as the fog lets its circle through" {
        val rig = Rig()
        rig.settlementsOnDisk[STOCKHOLM_TILE] = justOutside + farOff
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        rig.settle()
        sent.clear()

        mine.receive(subscribe(STOCKHOLM_Z10))

        // A settlement is a middle and a radius to the fog, as a stand is a middle and a reach.
        recordsOf(sent.standsOf("settlements").single()) shouldBe justOutside.toList()
        sent.standsOf("roads").single().stands shouldBe ""
    }

    "a cell too coarse for the scenery to be drawn in brings no stands" {
        val rig = Rig()
        rig.standsOnDisk[STOCKHOLM_TILE] = atTheSeat
        val (mine, sent) = rig.introduced(master = "terrain")
        mine.receive(founding())
        sent.clear()

        mine.receive(subscribe(STOCKHOLM_Z4))

        sent.standsOf().shouldBeEmpty()
        StandRecords.count(atTheSeat) shouldBe 1
    }
})
