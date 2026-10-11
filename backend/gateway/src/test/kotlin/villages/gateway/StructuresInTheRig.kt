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

/**
 * A fresh player raises one of nobody's with Adam's lever, a mill in Stockholm unless told otherwise. Of significance
 * ten, so it is worth drawing from zoom nine in. Many structures means many players, one command each.
 */
internal fun Rig.aStructureIsRaised(type: String = "mill", lat: Double = 59.33, lon: Double = 18.07) {
    val (someone, _) = someoneElse()
    someone.receive(raising(type, yours = false, lat = lat, lon = lon))
}
