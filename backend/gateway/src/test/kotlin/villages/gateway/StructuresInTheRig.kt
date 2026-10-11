package villages.gateway

import villages.domain.LevelSpec
import villages.domain.Significance
import villages.domain.StructureCatalogue
import villages.domain.StructureSpec
import villages.domain.StructureType

/** The rig's catalogue: two types of one level, enough for a lever to raise one and Antarctica to raise both. */
internal val RIG_CATALOGUE = StructureCatalogue(
    listOf("castle", "mill").associate { type ->
        StructureType(type) to StructureSpec(listOf(LevelSpec(Significance(10.0), 6.0, emptyMap())), emptyList())
    },
)
