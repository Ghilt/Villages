package villages.domain

/**
 * How much a thing matters to the world, from nothing to a hundred.
 *
 * The world's own judgement, made where the thing happens and carried on the event. It is not a map
 * setting, and since 2026-10-15 it does not decide how far out a thing is drawn: everything on the map is
 * drawn from one zoom. It ranks: which of a crowd of marks leads it, which a full cell carries, what is
 * seen through the fog. See decision records 0026 and 0096.
 */
@JvmInline
value class Significance(val value: Double) {
    init {
        require(value.isFinite()) { "significance is a number, not $value" }
        require(value in LEAST..MOST) { "significance runs $LEAST to $MOST, not $value" }
    }

    companion object {
        const val LEAST = 0.0
        const val MOST = 100.0
    }
}
