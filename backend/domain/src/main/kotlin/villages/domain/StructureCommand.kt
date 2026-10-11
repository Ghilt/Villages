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
/** Bring a structure down to ruin, for a reason a word or two long: fire, war, neglect. */
data class Ruin(
    override val structureId: StructureId,
    val cause: String,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : StructureCommand

/**
 * Raise a ruin again: as [structureType], or as what it was when null, at [level], for a house to hold or for
 * nobody. Rebuilding is not raising: the structure's history goes on, its name and its place with it.
 */
data class Rebuild(
    override val structureId: StructureId,
    val structureType: StructureType?,
    val level: Int,
    val holder: HouseId?,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : StructureCommand

data class HandOver(
    override val structureId: StructureId,
    val to: HouseId?,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : StructureCommand
