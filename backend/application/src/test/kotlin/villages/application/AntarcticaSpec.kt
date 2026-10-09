package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.LevelSpec
import villages.domain.Location
import villages.domain.RaiseStructure
import villages.domain.Significance
import villages.domain.StructureCatalogue
import villages.domain.StructureCommand
import villages.domain.StructureError
import villages.domain.StructureId
import villages.domain.StructureSpec
import villages.domain.StructureType
import villages.domain.WorldTime
import java.time.Instant

class AntarcticaSpec : StringSpec({

    val level = LevelSpec(Significance(10.0), 6.0, emptyMap())
    val catalogue = StructureCatalogue(
        listOf("castle", "mill", "printingHouse").associate { StructureType(it) to StructureSpec(listOf(level), emptyList()) },
    )
    val noon = Instant.parse("2026-10-08T12:00:00Z")

    /** A store that keeps what it is asked to raise, and refuses a second raising as the decider would. */
    class Raised : StructureCommandExecutor {
        val commands = mutableListOf<RaiseStructure>()

        override fun execute(command: StructureCommand, provenance: Provenance) {
            val raise = command as RaiseStructure
            if (commands.any { it.structureId == raise.structureId }) throw StructureError.AlreadyRaised
            commands += raise
        }
    }

    "every type stands once, held by nobody, at its first level, four to a row on the ice" {
        val store = Raised()

        Antarctica(store, catalogue, { noon }, { WorldTime(653_705) }).raise() shouldBe 3

        store.commands.map { it.name } shouldBe listOf("the Antarctic castle", "the Antarctic mill", "the Antarctic printing house")
        store.commands.map { it.structureId } shouldBe catalogue.types.keys.map(StructureId::inAntarctica)
        store.commands.all { it.holder == null && it.level == 1 } shouldBe true
        store.commands[1].place shouldBe Location(-77.4, 12.0)
        Antarctica.placeOf(5) shouldBe Location(-77.8, 12.0)
    }

    "starting again over a kept world raises none of them twice" {
        val store = Raised()
        val antarctica = Antarctica(store, catalogue, { noon }, { WorldTime(653_705) })
        antarctica.raise()

        antarctica.raise() shouldBe 0
        store.commands.size shouldBe 3
    }
})
