package villages.application

import villages.domain.CharacterId
import villages.domain.Location
import villages.domain.Significance
import villages.domain.WorldTime

/**
 * One stretch of world-time a character stood in one place: from the day they were moved there until the
 * day they were moved on, taken off the map or died, or open while they still stand there. Asked about a
 * day, a span holds it when `since <= day < until`, which is what makes the map at a moment a query and not
 * a replay. See decision record 0055.
 */
data class CharacterSpan(
    val place: Location,
    val significance: Significance,
    val since: WorldTime,
    val until: WorldTime?,
) {
    fun covers(at: WorldTime): Boolean = at >= since && (until == null || at < until)
}

/** A character standing somewhere, as the map draws them: who they are, and the span they stood in. */
data class PlacedCharacter(val row: CharacterRow, val span: CharacterSpan)

/** The characters one cell holds at one moment, as `CellContents` is for houses. */
data class CharactersInCell(
    val characters: List<PlacedCharacter>,
    /** Characters in the cell left out because the cell holds more than a screen should carry. */
    val omitted: Int,
)

/**
 * A character who moved on the map, left it, or died on it: the span they stood in before, closed, and the
 * one they stand in now. Either may be null - arriving from nowhere, or leaving for it - and a gateway
 * works out from the two which cells were told what.
 */
data class CharacterMapChange(val row: CharacterRow, val was: CharacterSpan?, val now: CharacterSpan?)

/**
 * The characters on the map, by cell, at a moment in world-time. The same three conditions as the houses'
 * (decision 0026): the place falls in the cell, the cell's zoom is at least the coarsest the character's
 * significance is drawn at, and the day asked about is inside the span.
 */
interface CharactersByCell {
    /**
     * The characters in `cell` on day `at`, most significant first, at most `most` of them, and of those only
     * the ones `seen` lets through, asked before the cap and never counted as omitted, as for houses.
     */
    fun inCell(
        cell: String,
        at: WorldTime,
        most: Int,
        everything: Boolean = false,
        seen: (PlacedCharacter) -> Boolean = { true },
    ): CharactersInCell

    /** Every move, departure and death on the map from now on, in the order applied, until closed. */
    fun watchTheMap(listener: (CharacterMapChange) -> Unit): AutoCloseable

    /**
     * Where one character stood on day `at`, or null when they stood on no map then: what a window on them asks,
     * wherever the camera is. See decision record 0087.
     */
    fun standing(id: CharacterId, at: WorldTime): PlacedCharacter? = null
}
