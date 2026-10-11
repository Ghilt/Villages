package villages.protocol

import com.fasterxml.jackson.annotation.JsonInclude

// How structures cross the wire: on the map, in a cell's snapshot and its deltas. See Frames.kt for what a frame is,
// and docs/plans/structures.md.

/**
 * A structure as a house is sent it: the face it had on the day the house last saw it, or on the day asked where it
 * sees. `structureType` is a type of the catalogue, by its key; `holder` is the house holding it in that face, absent
 * for nobody; `since` is the world-day it was raised. `stamp` is the read model's count of changes when this face
 * began, compared with a snapshot's `structuresAsOf`: of two copies of one structure the later stamp is the later
 * face, and a snapshot replaces any copy stamped no later than it. `seenUntil` is the day the fog hid it, absent while
 * the house sees it, as a house's is (0089).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class StructureView(
    val id: String,
    val structureType: String,
    val name: String,
    val place: Point,
    val cell: String,
    val level: Int,
    val holder: HolderView? = null,
    val significance: Double,
    val since: Long,
    val stamp: Long,
    val seenUntil: Long? = null,
    /** The house whose seat it is, in the face sent, or absent. */
    val seatOf: HolderView? = null,
)

/** A structure came to be in a cell this connection holds and sees. The client keeps it in the held cells its `cell` falls in. */
data class StructureArrived(val structure: StructureView) : Delta

/**
 * A structure in a cell this connection holds and sees took a new face: it changed hands. The whole view, as
 * `structureArrived` carries one, and a page lands it the same way, by its stamp.
 */
data class StructureChanged(val structure: StructureView) : Delta
