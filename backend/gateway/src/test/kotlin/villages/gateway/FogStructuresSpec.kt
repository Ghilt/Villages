package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.application.Holder
import villages.application.StructureFace
import villages.application.StructureRow
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
import villages.domain.StructureId
import villages.domain.StructureType
import villages.domain.Tincture
import villages.domain.Vision
import villages.domain.WorldTime
import java.util.UUID

private val me = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
private val them = PlayerId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"))
private val day = WorldTime(653_705)
private fun daysAgo(n: Long) = WorldTime(day.day - n)

private val stockholm = Location(59.33, 18.07)
private val nearby = Location(59.34, 18.06)
private val helsinki = Location(60.17, 24.94)
private val paris = Location(48.85, 2.35)

private val banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT)
private fun holder(of: PlayerId) = Holder(HouseId.of(of), HouseName.of("Kestrel"), banner)

private fun face(since: WorldTime, level: Int = 1, holder: Holder? = null, stamp: Long = 1) =
    StructureFace(StructureType("mill"), level, holder, Significance(10.0), since, stamp)

private fun structure(at: Location, vararg faces: StructureFace) =
    StructureRow(StructureId(UUID.randomUUID()), "a new mill", at, faces.toList())

/** A seat at Stockholm, and a vision of Helsinki that lasted from ten days ago until yesterday. */
private val seatAndAnEndedVision = listOf(
    VisionPoint(VisionSource.Seat, stockholm, Vision.MALLORCA, daysAgo(20), null),
    VisionPoint(VisionSource.Seat, helsinki, Vision.MALLORCA, daysAgo(10), daysAgo(1)),
)

/**
 * A structure through the fog, asked of `Fog` directly: the face of the day where the house sees it, the one it last saw
 * where it saw once, nothing where it never did. Rows are made by hand, because no event changes a face yet. See
 * docs/plans/structures.md.
 */
class FogStructuresSpec : StringSpec({

    "in vision, the face of the day asked, and no day the fog hid it" {
        val raised = face(daysAgo(5))

        Fog(me, seatAndAnEndedVision).faceOf(structure(nearby, raised), day) shouldBe (raised to null)
    }

    "on ground revealed and seen no longer, the face it had when the fog hid it: what happened since is not known" {
        val then = face(daysAgo(20))
        val since = face(day, level = 2, holder = holder(them), stamp = 2)

        Fog(me, seatAndAnEndedVision).faceOf(structure(helsinki, then, since), day) shouldBe (then to daysAgo(1))
    }

    "one raised there after the fog hid it is not sent at all" {
        Fog(me, seatAndAnEndedVision).faceOf(structure(helsinki, face(day)), day) shouldBe null
    }

    "on ground never seen, nothing; but a house's own is sent wherever it stands" {
        val fog = Fog(me, seatAndAnEndedVision)

        fog.faceOf(structure(paris, face(daysAgo(5))), day) shouldBe null
        val mine = face(daysAgo(5), holder = holder(me))
        fog.faceOf(structure(paris, mine), day) shouldBe (mine to null)
    }

    "asked again after it changed, the answer is worked out again" {
        val fog = Fog(me, seatAndAnEndedVision)
        val raised = face(daysAgo(5))
        val row = structure(nearby, raised)
        fog.faceOf(row, day) shouldBe (raised to null)

        val levelled = face(day, level = 2, stamp = 2)

        fog.faceOf(row.copy(faces = listOf(raised, levelled)), day) shouldBe (levelled to null)
    }
})
