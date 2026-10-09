package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.time.Instant
import java.util.UUID

class StructureDeciderSpec : StringSpec({

    val mill = StructureType("mill")
    val catalogue = StructureCatalogue(
        mapOf(
            mill to StructureSpec(
                listOf(
                    LevelSpec(Significance(8.0), 6.0, mapOf(Resource.WEALTH to 6.0)),
                    LevelSpec(Significance(10.0), 8.0, mapOf(Resource.WEALTH to 12.0)),
                ),
                emptyList(),
            ),
        ),
    )
    val decider = StructureDecider(catalogue)
    val id = StructureId(UUID.fromString("95ba5c28-4a79-3fa6-88aa-0ff1f5a0a559"))
    val house = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"))
    val noon = Instant.parse("2026-10-08T12:00:00Z")

    fun raise(type: StructureType = mill, level: Int = 2, name: String = "the mill at Dantzic", holder: HouseId? = house) =
        RaiseStructure(id, type, name, Location(54.36, 18.64), level, holder, WorldTime(653_705), noon)

    "a structure is raised with the catalogue's significance for its type at its level" {
        val raised = decider.decide(raise(), decider.initial).single()

        raised shouldBe StructureRaised(id, mill, "the mill at Dantzic", Location(54.36, 18.64), Significance(10.0), 2, house, WorldTime(653_705), noon)
    }

    "nobody may hold it" {
        decider.decide(raise(holder = null), decider.initial).single().shouldBeInstanceOf<StructureRaised>().holder shouldBe null
    }

    "what it was raised as is what its history folds to" {
        val standing = decider.fold(decider.decide(raise(), decider.initial))

        standing shouldBe Structure.Raised(id, mill, "the mill at Dantzic", Location(54.36, 18.64), Significance(10.0), 2, house, WorldTime(653_705))
    }

    "a structure is raised once" {
        val standing = decider.fold(decider.decide(raise(), decider.initial))

        shouldThrow<StructureError.AlreadyRaised> { decider.decide(raise(), standing) }
    }

    "a type the catalogue does not have cannot be raised" {
        shouldThrow<StructureError.NoSuchType> { decider.decide(raise(type = StructureType("cathedral")), decider.initial) }
    }

    "a level the type does not have cannot be raised to" {
        shouldThrow<StructureError.InvalidLevel> { decider.decide(raise(level = 0), decider.initial) }
        shouldThrow<StructureError.InvalidLevel> { decider.decide(raise(level = 3), decider.initial) }
    }

    "a structure has a name, and not a page of one" {
        shouldThrow<StructureError.InvalidName> { decider.decide(raise(name = "  "), decider.initial) }
        shouldThrow<StructureError.InvalidName> { decider.decide(raise(name = "x".repeat(81)), decider.initial) }
    }
})
