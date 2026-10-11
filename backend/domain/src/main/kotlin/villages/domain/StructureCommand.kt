package villages.domain

import java.time.Instant

/** A request to change a structure, named as an imperative. It may be refused, and it is not stored. */
sealed interface StructureCommand {
    val structureId: StructureId
}

/** Raise a structure of a type, at a level, at a place, under a name, for a house to hold or for nobody. */
data class RaiseStructure(
    override val structureId: StructureId,
    val structureType: StructureType,
    val name: String,
    val place: Location,
    val level: Int,
    val holder: HouseId?,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : StructureCommand

/**
 * Hand a structure to a house, or to nobody: a story handing it over, a house taking it, or for now Adam's lever
 * standing in for either. Only the structure's own history says who holds it, so this is the one decision that does.
 */
data class HandOver(
    override val structureId: StructureId,
    val to: HouseId?,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : StructureCommand
