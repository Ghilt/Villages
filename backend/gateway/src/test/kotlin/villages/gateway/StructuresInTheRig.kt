package villages.gateway

import villages.application.Provenance
import villages.application.StructureCommandExecutor
import villages.domain.LevelSpec
import villages.domain.Significance
import villages.domain.StructureCatalogue
import villages.domain.StructureCommand
import villages.domain.StructureSpec
import villages.domain.StructureType

/** The rig's catalogue: two types of one level, enough for a lever to raise one and Antarctica to raise both. */
internal val RIG_CATALOGUE = StructureCatalogue(
    listOf("castle", "mill").associate { type ->
        StructureType(type) to StructureSpec(listOf(LevelSpec(Significance(10.0), 6.0, emptyMap())), emptyList())
    },
)

/** What the structure levers asked to raise, in order. The rig keeps no structure's history yet: the levers' part is the asking. */
internal class RaisedInTheRig : StructureCommandExecutor {
    val commands = mutableListOf<StructureCommand>()

    override fun execute(command: StructureCommand, provenance: Provenance) {
        commands += command
    }
}
