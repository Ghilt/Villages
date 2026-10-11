package villages.application

import villages.domain.HouseId
import villages.domain.Location
import villages.domain.Significance
import villages.domain.StructureId
import villages.domain.StructureType
import villages.domain.WorldTime

/**
 * What a structure looked like from one moment of world-time until the next: its type, its level, who held it, and
 * how far out it was drawn. A new face begins with every event that changes one of those, and nothing else is kept in
 * it, because a structure's slots are never shown as last seen. [stamp] is how many changes the read model had
 * applied when this face began: monotonic across every structure, so of two copies of one the later stamp is the later
 * face, and a snapshot's `asOf` says which copies it replaces. See docs/plans/structures.md.
 */
data class StructureFace(
    val type: StructureType,
    val level: Int,
    /** The house holding it, with what a pennant needs, or nobody. */
    val holder: Holder?,
    val significance: Significance,
    val since: WorldTime,
    val stamp: Long,
    /** The house whose seat it is, with what a window names it by, or none. */
    val seatOf: Holder? = null,
)

/**
 * A structure as the map's read model holds it: where it stands, what it is called, and every face it has had, the
 * first first. A structure never moves, so its place and its cell are its own and not a face's.
 */
data class StructureRow(val id: StructureId, val name: String, val place: Location, val faces: List<StructureFace>) {
    /** The face it had on [day]: the latest begun by then, so of two changes on one day the later. Null before it stood. */
    fun faceOn(day: WorldTime): StructureFace? = faces.lastOrNull { it.since <= day }

    /** The most it was ever worth drawing, for telling cheaply which cells it might be drawn in. */
    val mostSignificant: Significance get() = faces.maxBy { it.significance.value }.significance
}

/** A change the read model has applied to a structure, and whether it was one it had not held before. */
data class StructureChange(val row: StructureRow, val appeared: Boolean)

/**
 * The map's read model of structures, by cell. Unlike the houses' it answers with every face a structure has had,
 * because which face a house is sent is the fog's to say: the one it last saw. See decision record 0092.
 */
interface StructuresByCell {
    /**
     * The structures standing in [cell] that might be drawn at its zoom - every one, with [everything] - whatever
     * their face on any one day. Which face is sent, and whether it is worth drawing then, is the caller's.
     */
    fun inCell(cell: String, everything: Boolean = false): List<StructureRow>

    /** One structure, with every face it has had, wherever it stands, or null for none: what a window asks after. */
    fun row(id: StructureId): StructureRow?

    /** Every structure [house] holds now, wherever it stands: its holdings, which its player is sent. */
    fun heldBy(house: HouseId): List<StructureRow>

    /** How many changes the read model has applied. Monotonic, and only ever compared with a face's stamp. */
    fun asOf(): Long

    /** Every change the read model makes from now on, in the order it applied them, until closed. */
    fun watch(listener: (StructureChange) -> Unit): AutoCloseable
}
