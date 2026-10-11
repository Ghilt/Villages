package villages.protocol

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

/**
 * What a batch carries: one change to what a connection's held cells hold, a house, a character or a structure, each told apart by
 * its `type`. Moved out of Frames.kt, past its ceiling, when the inspect frames came in.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(HouseAppeared::class, name = "houseAppeared"),
    JsonSubTypes.Type(HouseChanged::class, name = "houseChanged"),
    JsonSubTypes.Type(CharacterArrived::class, name = "characterArrived"),
    JsonSubTypes.Type(CharacterChanged::class, name = "characterChanged"),
    JsonSubTypes.Type(CharacterGone::class, name = "characterGone"),
    JsonSubTypes.Type(StructureArrived::class, name = "structureArrived"),
    JsonSubTypes.Type(StructureChanged::class, name = "structureChanged"),
)
sealed interface Delta

data class HouseAppeared(val house: HouseView) : Delta

data class HouseChanged(val house: HouseView) : Delta

/**
 * A character came to stand in a cell this connection holds, from nowhere or from a cell it did not hold.
 * Houses never move, so a client never had to drop anything; a character does, which is why there are three
 * of these where a house has two. The client keeps them in the held cells their `cell` falls in, and no
 * other.
 */
data class CharacterArrived(val character: CharacterOnMapView) : Delta

/** A character already drawn here moved within what this connection holds, or changed how they are drawn. */
data class CharacterChanged(val character: CharacterOnMapView) : Delta

/** A character left every cell this connection holds: moved away, taken off the map, or dead. */
data class CharacterGone(val id: String, val version: Long) : Delta
