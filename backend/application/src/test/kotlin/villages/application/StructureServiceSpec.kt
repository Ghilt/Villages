package villages.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import villages.domain.Banner
import villages.domain.CharacterId
import villages.domain.Charge
import villages.domain.Content
import villages.domain.ContentId
import villages.domain.Division
import villages.domain.EmptySlot
import villages.domain.FillSlot
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.RaiseStructure
import villages.domain.Significance
import villages.domain.StructureCommand
import villages.domain.StructureError
import villages.domain.StructureId
import villages.domain.StructureType
import villages.domain.Tincture
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID

class StructureServiceSpec : StringSpec({

    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val house = HouseId.of(ada)
    val noon = Instant.parse("2026-10-08T12:00:00Z")
    val today = WorldTime(653_705)
    val sent = UUID.fromString("5e0f5d1c-2a4b-4c6d-8e9f-0a1b2c3d4e5f")
    val dantzic = Location(54.36, 18.64)
    val banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT)
    val founded = HouseRow(
        house, ada, HouseName("Ravenscar"), dantzic, Significance(20.0), banner,
        resources = emptyMap(), pledges = emptyList(), since = today, until = null, version = 1,
    )

    fun rig(hasHouse: Boolean, slots: StructureSlots = NO_SLOTS): Pair<MutableList<StructureCommand>, StructureService> {
        val sentOn = mutableListOf<StructureCommand>()
        val houses = HouseById { id -> founded.takeIf { hasHouse && id == house } }
        return sentOn to StructureService({ command, _ -> sentOn += command }, houses, { noon }, { today }, slots, { sent })
    }

    "a structure is raised where asked, the player's house's, under an id worked out from the player and the command" {
        val (sentOn, service) = rig(hasHouse = true)

        val id = service.raise(ada, StructureType("printingHouse"), 2, dantzic, yours = true, Provenance.startedBy(sent))

        id shouldBe StructureId.raisedBy(ada, sent)
        sentOn.single() shouldBe RaiseStructure(id, StructureType("printingHouse"), "a new printing house", dantzic, 2, house, today, noon)
    }

    "or nobody's" {
        val (sentOn, service) = rig(hasHouse = false)

        service.raise(ada, StructureType("mill"), 1, dantzic, yours = false, Provenance.startedBy(sent))

        (sentOn.single() as RaiseStructure).holder shouldBe null
    }

    "a house that has not been founded holds nothing" {
        val (sentOn, service) = rig(hasHouse = false)

        shouldThrow<HouseError.NoSuchHouse> {
            service.raise(ada, StructureType("mill"), 1, dantzic, yours = true, Provenance.startedBy(sent))
        }
        sentOn.shouldBeEmpty()
    }

    val gaol = StructureId(UUID.fromString("95ba5c28-4a79-3fa6-88aa-0ff1f5a0a559"))
    val castle = StructureId(UUID.fromString("95ba5c28-4a79-3fa6-88aa-0ff1f5a0a55a"))
    val agnes = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))

    "a person put in a slot is taken out of the one they were in first, in the same story" {
        val (sentOn, service) = rig(hasHouse = true, slots = holding(agnes to PlaceInSlot(gaol, "cells")))

        service.fillWithPerson(castle, "dungeon", agnes, Provenance.startedBy(sent))

        sentOn shouldBe listOf(
            EmptySlot(gaol, "cells", ContentId(agnes.value), today, noon),
            FillSlot(castle, "dungeon", Content.Person(agnes), today, noon),
        )
    }

    "an item is put in under an id minted for it, and emptying a place takes out what was put in last" {
        val (sentOn, service) = rig(hasHouse = true, slots = holding(agnes to PlaceInSlot(gaol, "cells")))

        service.fillWithItem(castle, "garrison", " a garrison ", "forty men", 40, Provenance.startedBy(sent))
        service.emptyLast(gaol, "cells", Provenance.startedBy(sent))

        sentOn shouldBe listOf(
            FillSlot(castle, "garrison", Content.Item(ContentId(sent), "a garrison", "forty men", 40), today, noon),
            EmptySlot(gaol, "cells", ContentId(agnes.value), today, noon),
        )
        shouldThrow<StructureError.NotInSlot> { service.emptyLast(castle, "garrison", Provenance.startedBy(sent)) }
    }
})

/** Slots holding these people, each where it says, and nothing else. */
private fun holding(vararg people: Pair<CharacterId, PlaceInSlot>) = object : StructureSlots {
    override fun of(structure: StructureId): Map<String, List<Content>> =
        people.filter { it.second.structure == structure }.groupBy({ it.second.slot }, { Content.Person(it.first) })

    override fun slotOf(character: CharacterId): PlaceInSlot? = people.firstOrNull { it.first == character }?.second
}

/** Slots with nothing in them and nobody put anywhere. */
private val NO_SLOTS = object : StructureSlots {
    override fun of(structure: villages.domain.StructureId) = emptyMap<String, List<villages.domain.Content>>()

    override fun slotOf(character: villages.domain.CharacterId): PlaceInSlot? = null
}
