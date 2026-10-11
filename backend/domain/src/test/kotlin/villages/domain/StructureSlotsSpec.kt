package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.time.Instant
import java.util.UUID

/** A structure's slots: strict about how many and about once each, permissive about what. */
class StructureSlotsSpec : StringSpec({
    val prison = StructureType("prison")
    val catalogue = StructureCatalogue(
        mapOf(
            prison to StructureSpec(
                listOf(LevelSpec(Significance(8.0), 6.0, emptyMap()), LevelSpec(Significance(10.0), 8.0, emptyMap())),
                listOf(
                    SlotSpec("warden", Takes.CHARACTER, listOf(1, 1), SeenBy.ALL),
                    SlotSpec("cells", Takes.CHARACTER, listOf(1, 2), SeenBy.HOLDER),
                ),
            ),
        ),
    )
    val decider = StructureDecider(catalogue)
    val id = StructureId(UUID.fromString("95ba5c28-4a79-3fa6-88aa-0ff1f5a0a559"))
    val day = WorldTime(653_705)
    val noon = Instant.parse("2026-10-08T12:00:00Z")
    val agnes = Content.Person(CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f")))
    val wilhelm = Content.Person(CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578e")))
    val relic = Content.Item(ContentId(UUID.fromString("7a000000-0000-4000-8000-000000000001")), "a relic", "", null)

    fun standing(level: Int = 2) = decider.fold(
        decider.decide(RaiseStructure(id, prison, "the gaol", Location(54.36, 18.64), level, null, day, noon), decider.initial),
    )

    fun fill(slot: String, content: Content) = FillSlot(id, slot, content, day, noon)
    fun after(state: Structure, vararg commands: StructureCommand): Structure =
        commands.fold(state) { at, command -> decider.decide(command, at).fold(at, decider::evolve) }

    "a person is put in a place, after whatever is there, and the structure holds them" {
        val filled = decider.decide(fill("cells", agnes), standing()).single()
        val held = after(standing(), fill("cells", agnes), fill("cells", wilhelm)).shouldBeInstanceOf<Structure.Raised>()

        filled shouldBe StructureSlotFilled(id, "cells", agnes, day, noon)
        held.slots shouldBe mapOf("cells" to listOf(agnes, wilhelm))
    }

    "a slot holds no more than its places at the structure's level" {
        shouldThrow<StructureError.SlotFull> { decider.decide(fill("cells", wilhelm), after(standing(level = 1), fill("cells", agnes))) }
    }

    "a content is in a structure's slots at most once, whichever slot" {
        shouldThrow<StructureError.AlreadyInSlot> { decider.decide(fill("warden", agnes), after(standing(), fill("cells", agnes))) }
    }

    "permissive about what: a relic in the cells is put there all the same" {
        after(standing(), fill("cells", relic)).shouldBeInstanceOf<Structure.Raised>().slots["cells"] shouldBe listOf(relic)
    }

    "a slot the type does not have, an item with no name, and a ruin are refused" {
        shouldThrow<StructureError.NoSuchSlot> { decider.decide(fill("throne", agnes), standing()) }
        shouldThrow<StructureError.InvalidContent> { decider.decide(fill("cells", relic.copy(name = " ")), standing()) }
        val ruin = after(standing(), Ruin(id, "fire", day, noon))
        shouldThrow<StructureError.IsARuin> { decider.decide(fill("cells", agnes), ruin) }
    }

    "one is taken out and the rest stay; what is not there cannot be taken out" {
        val two = after(standing(), fill("cells", agnes), fill("cells", wilhelm))

        val one = after(two, EmptySlot(id, "cells", agnes.id, day, noon)).shouldBeInstanceOf<Structure.Raised>()

        one.slots shouldBe mapOf("cells" to listOf(wilhelm))
        after(one, EmptySlot(id, "cells", wilhelm.id, day, noon)).shouldBeInstanceOf<Structure.Raised>().slots shouldBe emptyMap()
        shouldThrow<StructureError.NotInSlot> { decider.decide(EmptySlot(id, "cells", agnes.id, day, noon), one) }
    }

    "a ruin keeps what is in it, and it can still be taken out" {
        val ruin = after(standing(), fill("cells", agnes), Ruin(id, "fire", day, noon)).shouldBeInstanceOf<Structure.Raised>()

        ruin.slots shouldBe mapOf("cells" to listOf(agnes))
        decider.decide(EmptySlot(id, "cells", agnes.id, day, noon), ruin).single().shouldBeInstanceOf<StructureSlotEmptied>()
    }

    "a level is not lowered under what a slot holds" {
        val full = after(standing(level = 2), fill("cells", agnes), fill("cells", wilhelm))

        shouldThrow<StructureError.InvalidLevel> { decider.decide(ChangeLevel(id, -1, day, noon), full) }
        decider.decide(ChangeLevel(id, -1, day, noon), after(full, EmptySlot(id, "cells", wilhelm.id, day, noon))).single()
            .shouldBeInstanceOf<StructureLevelChanged>()
    }
})
