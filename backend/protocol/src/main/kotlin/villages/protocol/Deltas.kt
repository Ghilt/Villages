package villages.protocol

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

/**
 * What a batch carries: one change to what a connection's held cells hold, a character or a structure, each told apart by
 * its `type`; no house, because a house is not drawn on the map. Moved out of Frames.kt, past its ceiling, when the inspect frames came in.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(CharacterArrived::class, name = "characterArrived"),
    JsonSubTypes.Type(CharacterChanged::class, name = "characterChanged"),
    JsonSubTypes.Type(CharacterGone::class, name = "characterGone"),
    JsonSubTypes.Type(StructureArrived::class, name = "structureArrived"),
    JsonSubTypes.Type(StructureChanged::class, name = "structureChanged"),
)
sealed interface Delta

/**
 * A character came to stand in a cell this connection holds, from nowhere or from a cell it did not hold.
 * A character moves, so a client drops one that has gone as well as landing one that came. The client keeps them in
 * the held cells their `cell` falls in, and no other.
 */
data class CharacterArrived(val character: CharacterOnMapView) : Delta

/** A character already drawn here moved within what this connection holds, or changed how they are drawn. */
data class CharacterChanged(val character: CharacterOnMapView) : Delta

/** A character left every cell this connection holds: moved away, taken off the map, or dead. */
data class CharacterGone(val id: String, val version: Long) : Delta
