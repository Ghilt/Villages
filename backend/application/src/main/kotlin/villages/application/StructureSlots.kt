package villages.application

import villages.domain.CharacterId
import villages.domain.Content
import villages.domain.StructureId

/** Where a person is put: a slot of a structure. */
data class PlaceInSlot(val structure: StructureId, val slot: String)

/**
 * What is in the structures' slots now, as the read model folds it: what a structure's slots hold, and which slot a
 * person is in, if any. Never as last seen, so only now. What the use case that fills a slot reads to take a person
 * out of the slot they were in first. See docs/plans/structures.md.
 */
interface StructureSlots {
    /** What each slot of [structure] holds, by the slot's name, in the order it was put there; empty for none. */
    fun of(structure: StructureId): Map<String, List<Content>>

    /** The slot [character] is in, or null. */
    fun slotOf(character: CharacterId): PlaceInSlot?
}
