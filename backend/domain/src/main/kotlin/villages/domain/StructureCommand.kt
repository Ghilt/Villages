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
 * Put a person or an item in a place of one of a structure's slots: a prisoner in the cells, a relic in the reliquary.
 * Strict about how many - the slot's places at the structure's level - and permissive about what: a story may put a
 * relic on a throne. A person already in another slot is taken out of it first, by the use case.
 */
data class FillSlot(
    override val structureId: StructureId,
    val slot: String,
    val content: Content,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : StructureCommand

/** Take one content out of a slot, leaving the rest: one prisoner let out of cells that hold four. */
data class EmptySlot(
    override val structureId: StructureId,
    val slot: String,
    val contentId: ContentId,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : StructureCommand

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

/**
 * Raise or lower a structure by [by] levels, within the levels its type has: up is better. Its significance follows
 * the catalogue's for the new level, and what it gives its holder follows that, by listeners.
 */
data class ChangeLevel(
    override val structureId: StructureId,
    val by: Int,
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
