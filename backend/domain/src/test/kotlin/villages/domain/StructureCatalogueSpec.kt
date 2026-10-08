package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe

class StructureCatalogueSpec : StringSpec({

    val level = LevelSpec(Significance(10.0), sightKm = 6.0, yieldsPerMonth = mapOf(Resource.WEALTH to 6.0))
    fun slot(places: List<Int>, name: String = "granary") =
        SlotSpec(name, Takes.ITEM, places, SeenBy.ALL)

    "a type answers what it is at each of its levels, and refuses a level it does not have" {
        val mill = StructureSpec(listOf(level, level.copy(sightKm = 8.0)), listOf(slot(listOf(1, 2))))
        mill.highest shouldBe 2
        mill.at(2).sightKm shouldBe 8.0
        shouldThrow<IllegalArgumentException> { mill.at(0) }
        shouldThrow<IllegalArgumentException> { mill.at(3) }
    }

    "every structure sees a little" {
        shouldThrow<IllegalArgumentException> { level.copy(sightKm = 0.0) }
    }

    "a slot says its places at every level, and never has fewer a level higher" {
        shouldThrow<IllegalArgumentException> { StructureSpec(listOf(level, level), listOf(slot(listOf(1)))) }
        shouldThrow<IllegalArgumentException> { slot(listOf(2, 1)) }
    }

    "a type's slots have a name apiece" {
        shouldThrow<IllegalArgumentException> { StructureSpec(listOf(level), listOf(slot(listOf(1)), slot(listOf(2)))) }
    }

    "a type is named in lower camel case, and a catalogue lists at least one" {
        StructureType("printingHouse").name shouldBe "printingHouse"
        shouldThrow<IllegalArgumentException> { StructureType("Printing house") }
        shouldThrow<IllegalArgumentException> { StructureCatalogue(emptyMap()) }
    }
})
