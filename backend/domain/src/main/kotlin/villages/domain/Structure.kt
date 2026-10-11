package villages.domain

/**
 * A structure as its own history folds it: not raised yet, or standing - its type, its name, where it stands and how
 * far out it is drawn, its level, who holds it, a house or nobody, and what is in its slots. Its own stream, `structure:<uuid>`, because a
 * structure outlives and changes holders, and only its own history can say which one holds it. See decision record
 * 0093.
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
        /** What is in each slot, by the slot's name, in the order it was put there; a slot with nothing in it is absent. */
        val slots: Map<String, List<Content>> = emptyMap(),
    ) : Structure {
        /** Whether this content is in any of its slots. */
        fun holds(content: ContentId): Boolean = slots.values.any { held -> held.any { it.id == content } }
    }
}
