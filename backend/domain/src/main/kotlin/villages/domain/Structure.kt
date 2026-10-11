package villages.domain

/**
 * A structure as its own history folds it: not raised yet, or standing - its type, its name, where it stands and how
 * far out it is drawn, its level, and who holds it, a house or nobody. Its own stream, `structure:<uuid>`, because a
 * structure outlives and changes holders, and only its own history can say which one holds it. See decision record
 * 0092.
 */
sealed interface Structure {
    data object NotRaised : Structure

    data class Raised(
        val id: StructureId,
        val type: StructureType,
        val name: String,
        val place: Location,
        val significance: Significance,
        val level: Int,
        val holder: HouseId?,
        val raisedOn: WorldTime,
        /** Fallen: no holder, nothing given, and something that can be raised again. */
        val ruined: Boolean = false,
    ) : Structure
}
