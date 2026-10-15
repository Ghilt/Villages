package villages.protocol

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.tan

/**
 * The grid the world is partitioned by, and how far out a thing is worth drawing.
 *
 * A cell is a Web Mercator tile address written as one digit per zoom level, most significant first:
 * each digit is the tile's x bit plus twice its y bit at that level. So **a cell's ancestor is its
 * prefix**, and that one property is what makes the map affordable. Everything inside a tile is a prefix
 * match; zooming out drops a character; finding every session that should hear about a thing is walking
 * its own prefixes. A cell at zoom 2 is a quarter of the world and a cell at zoom 10 a few tens of
 * kilometres, and they are the same kind of thing.
 *
 * This lives beside the frames because both ends must compute it identically - the browser works out
 * which tiles cover its viewport, the server works out which tile a thing falls in, and a disagreement
 * would be a hole in the map. `contracts/fixtures/cells.json` holds the vectors both are held to.
 *
 * It is deliberately not in the domain. Where a house sits is a fact about the world; which tile that
 * falls in is a fact about how we draw and route it, and the domain says neither. See decision record
 * 0026.
 */
@JvmInline
value class Cell(val quadkey: String) {
    init {
        require(quadkey.length <= MAX_ZOOM) { "a cell goes no deeper than $MAX_ZOOM, not ${quadkey.length}" }
        require(quadkey.all { it in '0'..'3' }) { "a quadkey is digits 0 to 3, not $quadkey" }
    }

    /** How deep this cell is. The empty quadkey is zoom zero: the whole world, one tile. */
    val zoom: Int get() = quadkey.length

    /** The cell containing this one at a shallower zoom, which is simply its prefix. */
    fun at(zoom: Int): Cell {
        require(zoom in 0..this.zoom) { "$quadkey is at ${this.zoom}, so it has no ancestor at $zoom" }
        return Cell(quadkey.take(zoom))
    }

    /** Whether this cell lies within the given one, at any depth. The whole of the spatial query. */
    fun isInside(tile: Cell): Boolean = quadkey.startsWith(tile.quadkey)

    /** Which column of the grid at its own zoom this cell is, counted from the west: its digits' x bits. */
    val column: Int get() = quadkey.fold(0) { x, digit -> (x shl 1) or ((digit - '0') and 1) }

    /** Which row of the grid at its own zoom this cell is, counted from the north: its digits' y bits. */
    val row: Int get() = quadkey.fold(0) { y, digit -> (y shl 1) or ((digit - '0') shr 1) }

    companion object {
        /** How deep the grid goes, which is where the world's own painted detail runs out. */
        const val MAX_ZOOM = 10

        /** Mercator cannot draw the poles; beyond this a place is in the edge row of cells. */
        const val MERCATOR_EDGE = 85.05112878

        /** Which cell a place falls in, at the deepest zoom unless told otherwise. */
        fun of(lat: Double, lon: Double, zoom: Int = MAX_ZOOM): Cell {
            require(zoom in 0..MAX_ZOOM) { "there is no zoom $zoom in a grid $MAX_ZOOM deep" }
            val tiles = 1 shl zoom
            val x = clamp(floor((lon + 180.0) / 360.0 * tiles).toInt(), tiles)
            val radians = lat.coerceIn(-MERCATOR_EDGE, MERCATOR_EDGE) * PI / 180.0
            val mercator = ln(tan(radians) + 1.0 / cos(radians))
            val y = clamp(floor((1.0 - mercator / PI) / 2.0 * tiles).toInt(), tiles)
            return Cell(quadkeyOf(x, y, zoom))
        }

        private fun clamp(tile: Int, tiles: Int): Int = tile.coerceIn(0, tiles - 1)

        private fun quadkeyOf(x: Int, y: Int, zoom: Int): String {
            val digits = CharArray(zoom)
            for (level in zoom downTo 1) {
                val bit = 1 shl (level - 1)
                var digit = 0
                if (x and bit != 0) digit += 1
                if (y and bit != 0) digit += 2
                digits[zoom - level] = ('0' + digit)
            }
            return String(digits)
        }
    }
}

/**
 * The coarsest zoom anything on the map is sent at, whatever its significance: every structure and every person from
 * the same zoom, so they arrive together and the page fades them in together at 7.25, a quarter of a level in.
 *
 * Significance ranks what is on the map - which of a crowd of marks leads it, which two hundred a cell carries, what is
 * seen through the fog - and no longer decides how far out a thing is drawn. It did, from 0026 to 2026-10-15, and a mill
 * arrived two levels after a cathedral. See decision record 0096.
 */
const val ON_THE_MAP_FROM: Int = 7
