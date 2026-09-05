package villages.domain

/**
 * How much a thing matters to the world, from nothing to a hundred.
 *
 * The world's own judgement, made where the thing happens and carried on the event. It is not a map
 * setting: everything downstream that has to decide how far out something is still worth drawing reads
 * this rather than guessing from what kind of thing it is. A hundred is drawn from the whole world.
 *
 * The domain says how much it matters. What that means for a zoom level is decided outside, in
 * `villages.protocol.coarsestZoom`. See decision record 0026.
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
