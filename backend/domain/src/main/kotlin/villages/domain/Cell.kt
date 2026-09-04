package villages.domain

import kotlin.math.PI
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.tan

/**
 * A fixed square of the world used to partition live updates and map queries: a quadkey at zoom 8.
 *
 * Computed here, once, and carried on every event, so that routing keys, gateway subscriptions and read
 * model queries never recompute it and can never disagree. The same arithmetic runs in the browser from
 * the shared vectors in `contracts/fixtures/cells.json`. See decision record 0007.
 *
 * A quadkey is the Web Mercator tile address written as one digit per zoom level, most significant first:
 * each digit is the tile's x bit plus twice its y bit at that level, so a cell's parent is its prefix.
 */
@JvmInline
value class Cell(val quadkey: String) {
    init {
        require(quadkey.length == ZOOM) { "a cell is $ZOOM digits, not ${quadkey.length}" }
        require(quadkey.all { it in '0'..'3' }) { "a quadkey is digits 0 to 3, not $quadkey" }
    }

    companion object {
        const val ZOOM = 8
        private const val TILES = 1 shl ZOOM

        /** Mercator cannot draw the poles; beyond this a place is in the edge row of cells. */
        const val MERCATOR_EDGE = 85.05112878

        fun of(location: Location): Cell {
            val x = clamp(floor((location.lon + 180.0) / 360.0 * TILES).toInt())
            val lat = location.lat.coerceIn(-MERCATOR_EDGE, MERCATOR_EDGE) * PI / 180.0
            val mercator = ln(tan(lat) + 1.0 / kotlin.math.cos(lat))
            val y = clamp(floor((1.0 - mercator / PI) / 2.0 * TILES).toInt())
            return Cell(quadkeyOf(x, y))
        }

        private fun clamp(tile: Int): Int = tile.coerceIn(0, TILES - 1)

        private fun quadkeyOf(x: Int, y: Int): String {
            val digits = CharArray(ZOOM)
            for (level in ZOOM downTo 1) {
                val bit = 1 shl (level - 1)
                var digit = 0
                if (x and bit != 0) digit += 1
                if (y and bit != 0) digit += 2
                digits[ZOOM - level] = ('0' + digit)
            }
            return String(digits)
        }
    }
}
