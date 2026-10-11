package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.application.CharacterById
import villages.application.Holder
import villages.application.StructureFace
import villages.application.StructureRow
import villages.application.VisionPoint
import villages.application.VisionSource
import villages.domain.Banner
import villages.domain.CharacterId
import villages.domain.Charge
import villages.domain.Content
import villages.domain.ContentId
import villages.domain.Division
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.LevelSpec
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.SeenBy
import villages.domain.Significance
import villages.domain.SlotSpec
import villages.domain.StructureCatalogue
import villages.domain.StructureId
import villages.domain.StructureSpec
import villages.domain.StructureType
import villages.domain.Takes
import villages.domain.Tincture
import villages.domain.Vision
import villages.domain.WorldTime
import villages.protocol.ContentView
import villages.protocol.SlotView
import java.util.UUID

private val me = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
private val them = PlayerId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"))
private val day = WorldTime(653_705)
private val stockholm = Location(59.33, 18.07)
private val paris = Location(48.85, 2.35)
private val castle = StructureType("castle")
private val catalogue = StructureCatalogue(
    mapOf(
        castle to StructureSpec(
            listOf(LevelSpec(Significance(20.0), 34.0, emptyMap()), LevelSpec(Significance(24.0), 40.0, emptyMap())),
            listOf(
                SlotSpec("lord", Takes.CHARACTER, listOf(1, 1), SeenBy.ALL),
                SlotSpec("garrison", Takes.ITEM, listOf(1, 1), SeenBy.HOLDER),
                SlotSpec("dungeon", Takes.CHARACTER, listOf(1, 2), SeenBy.HOLDER),
            ),
        ),
    ),
)
private val agnes = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))
private val garrison = Content.Item(ContentId(UUID.fromString("7a000000-0000-4000-8000-000000000040")), "a garrison", "", 40)
private val seen = SlotsSeen(catalogue, CharacterById { null })
private fun holder(of: PlayerId) =
    Holder(HouseId.of(of), HouseName.of("Kestrel"), Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT))

private fun keep(at: Location, held: PlayerId = them) = StructureRow(
    StructureId(UUID.randomUUID()), "a castle", at,
    listOf(StructureFace(castle, 2, holder(held), Significance(24.0), WorldTime(day.day - 5), stamp = 3)),
    slots = mapOf("lord" to listOf(Content.Person(agnes)), "garrison" to listOf(garrison)),
    slotsStamp = 7,
)

private val lordSeen = ContentView("person", agnes.value.toString(), SlotsSeen.SOMEONE)
private val garrisonSeen = ContentView("item", garrison.itemId.value.toString(), "a garrison", amount = 40)

/** What a house is shown of a structure's slots: never as last seen, and of another's only the public ones. */
class SlotsSeenSpec : StringSpec({

    "its holder sees into every slot, with how many places at its level" {
        val row = keep(stockholm, held = me)

        seen.of(row, row.faces.last(), HouseId.of(me), everything = false) shouldBe listOf(
            SlotView("lord", 1, listOf(lordSeen)),
            SlotView("garrison", 1, listOf(garrisonSeen)),
            SlotView("dungeon", 2, emptyList()),
        )
    }

    "another house sees into the public ones, and of the rest only how many places" {
        val row = keep(stockholm)

        seen.of(row, row.faces.last(), HouseId.of(me), everything = false) shouldBe listOf(
            SlotView("lord", 1, listOf(lordSeen)),
            SlotView("garrison", 1, null),
            SlotView("dungeon", 2, null),
        )
    }

    "sent while it is seen today, with the later stamp; on ground seen no longer, or on a day gone by, no slots" {
        val inSight = Looking(fog = Fog(me, listOf(VisionPoint(VisionSource.Seat, stockholm, Vision.MALLORCA, WorldTime(day.day - 20), null))), slots = seen)
        val near = keep(stockholm)

        inSight.sent(near, day)!!.let { listOf(it.slots?.size, it.stamp) } shouldBe listOf(3, 7L)
        inSight.copy(at = day).sent(near, day)!!.slots shouldBe null

        val revealedOnce = Looking(
            fog = Fog(
                me,
                listOf(
                    VisionPoint(VisionSource.Seat, stockholm, Vision.MALLORCA, WorldTime(day.day - 20), null),
                    VisionPoint(VisionSource.Seat, paris, Vision.MALLORCA, WorldTime(day.day - 10), WorldTime(day.day - 1)),
                ),
            ),
            slots = seen,
        )
        revealedOnce.sent(keep(paris), day)!!.let { listOf(it.slots, it.stamp) } shouldBe listOf(null, 3L)
    }
})
