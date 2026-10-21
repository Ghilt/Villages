package villages.domain.challenge

/**
 * One of the ten flavours a challenge is fought in, listed in their five pairs, each beside its [anti]-aspect: a pair
 * is one dimension with two poles. Not a structure's type, and `REASON` here is neither the resource nor the stat.
 * See decision record 0107.
 */
enum class Aspect {
    VIOLENCE,
    DIPLOMACY,
    HOLY,
    REASON,
    AUTHORITY,
    FREEDOM,
    GREED,
    GENEROSITY,
    NATURE,
    INDUSTRY,
    ;

    /** The other pole of this aspect's pair: Violence's is Diplomacy, and Diplomacy's Violence. */
    val anti: Aspect get() = entries[ordinal xor 1]
}

/** One of a challenge's two sides. The tug is side A's way up. */
enum class Side {
    A,
    B,
    ;

    val other: Side get() = if (this == A) B else A
}
