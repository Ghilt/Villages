package villages.bots

import villages.protocol.Cell
import villages.protocol.Point

/**
 * The cells a bot follows: the one a point is in and the eight round it, at one zoom, as a page looking at that point
 * at about that zoom would ask for. Nine is well under the 64 a connection may hold.
 */
object Neighbourhood {
    const val ZOOM = 8

    fun round(point: Point, zoom: Int = ZOOM): List<String> {
        val (x, y) = tileOf(Cell.of(point.lat, point.lon, zoom).quadkey)
        val tiles = 1 shl zoom
        return (-1..1).flatMap { dy ->
            (-1..1).mapNotNull { dx ->
                val ty = y + dy
                if (ty !in 0 until tiles) null else quadkeyOf(Math.floorMod(x + dx, tiles), ty, zoom)
            }
        }
    }

    private fun tileOf(quadkey: String): Pair<Int, Int> {
        var x = 0
        var y = 0
        for (digit in quadkey) {
            val d = digit - '0'
            x = (x shl 1) or (d and 1)
            y = (y shl 1) or (d shr 1)
        }
        return x to y
    }

    private fun quadkeyOf(x: Int, y: Int, zoom: Int): String = buildString {
        for (level in zoom - 1 downTo 0) {
            append(((x shr level) and 1) + 2 * ((y shr level) and 1))
        }
    }
}
