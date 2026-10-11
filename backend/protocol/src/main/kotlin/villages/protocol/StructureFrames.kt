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
    /** True for a ruin, in the face sent, and absent for a structure standing. */
    val ruin: Boolean? = null,
    /**
     * Its slots as this house is shown them, only while it sees the structure now: every one for its holder, and for
     * another house the public ones and of the rest how many places. Absent out of sight, on a day gone by, and for a
     * type with none. When present, `stamp` is the later of the face's and the slots' last change.
     */
    val slots: List<SlotView>? = null,
    /**
     * What it yields its holder a world month, by resource, what fills its slots counted: only in its holder's own
     * view, because what is in a slot that only the holder sees into would show in it. Absent for anybody else.
     */
    val yields: Map<String, Double>? = null,
)

/**
 * One slot of a structure as a house is shown it: its name, how many places it has at the structure's level, and
 * what is in them in the order it was put there - absent, rather than empty, for a slot this house may not see into.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class SlotView(val name: String, val places: Int, val contents: List<ContentView>? = null)

/**
 * What fills a place: `kind` `person`, with their name and the key of their portrait, or `item`, with what it is
 * called, a line about it and how many of it. `id` is the person's or the item's.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class ContentView(
    val kind: String,
    val id: String,
    val name: String,
    val portrait: String? = null,
    val about: String? = null,
    val amount: Long? = null,
)

/**
 * The player's holdings: every structure their house holds now, wherever it stands, its seat first and the rest in
 * the order the house came to hold them, each in today's face. Sent after `yourKeyFigures` on hello, always a list
 * and empty when there are none, and again whenever one is raised for the house, taken, or handed away. What a house
 * holds is its own, like what it has. See docs/plans/structures.md.
 */
data class YourHoldings(val holdings: List<StructureView>) : ServerFrame

/** A structure came to be in a cell this connection holds and sees. The client keeps it in the held cells its `cell` falls in. */
data class StructureArrived(val structure: StructureView) : Delta

/**
 * A structure in a cell this connection holds and sees took a new face: it changed hands. The whole view, as
 * `structureArrived` carries one, and a page lands it the same way, by its stamp.
 */
data class StructureChanged(val structure: StructureView) : Delta
