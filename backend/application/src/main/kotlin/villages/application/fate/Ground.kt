package villages.application.fate

import villages.domain.Location
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.floor

/**
 * A master's ground map as the server holds it: a grid on the master's latitude and longitude, two bytes a cell,
 * the commonest terrain class and its marks. Cut by `npm run world:ground`; see decision record 0084.
 */
class GroundMap(
    val width: Int,
    val height: Int,
    /** Each terrain class's name, by the number a cell holds. */
    val classes: Map<Int, String>,
    private val cells: ByteArray,
) {
    init {
        require(cells.size == width * height * 2) { "a ground map of $width by $height is ${width * height * 2} bytes" }
    }

    /** The cell a place falls in: its terrain class's name and its marks. */
    fun at(place: Location): GroundCell = indexOf(place).let { cell(it % width, it / width) }

    /** The number of the cell a place falls in, counted row by row from the north-west corner. */
    fun indexOf(place: Location): Int {
        val x = floor((place.lon + 180) / 360 * width).toInt().coerceIn(0, width - 1)
        val y = floor((90 - place.lat) / 180 * height).toInt().coerceIn(0, height - 1)
        return y * width + x
    }

    fun cell(x: Int, y: Int): GroundCell {
        val i = (y * width + x) * 2
        return GroundCell(classes[cells[i].toInt() and 0xFF] ?: "unknown", cells[i + 1].toInt() and 0xFF)
    }

    /**
     * The first cell, row by row, of the water marked [mark] that cell [index] is joined to, side to side or corner to
     * corner and across the antimeridian; null where the cell holds none of it. The same for every cell of one lake,
     * one river's water or one sea, which is what names water nobody has named. Each mark's water is followed through
     * the whole map once, the first time it is asked about.
     */
    fun waterJoinedTo(mark: Int, index: Int): Int? =
        joined.computeIfAbsent(mark) { follow(it) }[index].takeIf { it >= 0 }

    private val joined = ConcurrentHashMap<Int, IntArray>()

    private fun follow(mark: Int): IntArray {
        val first = IntArray(width * height) { -1 }
        val waiting = IntArray(width * height)
        for (start in first.indices) {
            if (first[start] >= 0 || !holds(start, mark)) continue
            first[start] = start
            var head = 0
            var tail = 0
            waiting[tail++] = start
            while (head < tail) {
                val at = waiting[head++]
                val x = at % width
                val y = at / width
                for (dy in -1..1) {
                    val ny = y + dy
                    if (ny !in 0 until height) continue
                    for (dx in -1..1) {
                        val next = ny * width + Math.floorMod(x + dx, width)
                        if (first[next] < 0 && holds(next, mark)) {
                            first[next] = start
                            waiting[tail++] = next
                        }
                    }
                }
            }
        }
        return first
    }

    private fun holds(index: Int, mark: Int): Boolean = cells[index * 2 + 1].toInt() and mark != 0

    /** Where a cell's middle is. */
    fun middleOf(x: Int, y: Int): Location =
        Location(90 - (y + 0.5) / height * 180, (x + 0.5) / width * 360 - 180)

    companion object {
        const val RIVER = 1
        const val COAST = 2
        const val LAKE = 4
        const val SEA = 8
    }
}

/** One cell of the ground: what it mostly is, and what water is in it. */
data class GroundCell(val terrain: String, val marks: Int) {
    fun has(mark: Int): Boolean = marks and mark != 0
}

/** Each master's ground map, by the master's name, or null for a master with none. */
fun interface GroundMaps {
    fun of(master: String): GroundMap?
}
