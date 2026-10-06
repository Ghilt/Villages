package villages.application.fate

import villages.domain.Location
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
    fun at(place: Location): GroundCell {
        val x = floor((place.lon + 180) / 360 * width).toInt().coerceIn(0, width - 1)
        val y = floor((90 - place.lat) / 180 * height).toInt().coerceIn(0, height - 1)
        return cell(x, y)
    }

    fun cell(x: Int, y: Int): GroundCell {
        val i = (y * width + x) * 2
        return GroundCell(classes[cells[i].toInt() and 0xFF] ?: "unknown", cells[i + 1].toInt() and 0xFF)
    }

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
