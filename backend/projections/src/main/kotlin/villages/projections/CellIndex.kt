package villages.projections

import villages.protocol.Cell
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentSkipListSet
import kotlin.math.cos

/**
 * Which rows stand in which cell, kept so that a cell is answered from its own rows and not by walking every row a read
 * model has. A cell is a quadkey and its rows are those whose quadkey starts with it, at any zoom (decision record
 * 0026); kept sorted by quadkey, they are one range of the index, from the cell to the cell followed by the last
 * character there is. Each entry is `quadkey|id`, so two rows in one cell are two entries. See
 * `docs/plans/indexed-read-models.md`.
 */
internal class CellIndex<Id : Any>(private val textOf: (Id) -> String, private val idOf: (String) -> Id) {
    private val entries = ConcurrentSkipListSet<String>()

    fun add(quadkey: String, id: Id) {
        entries += key(quadkey, id)
    }

    fun remove(quadkey: String, id: Id) {
        entries -= key(quadkey, id)
    }

    /** The ids in this cell, by quadkey, without looking at any row outside it. */
    fun inCell(cell: String): Sequence<Id> =
        entries.subSet(cell, true, cell + Char.MAX_VALUE, false).asSequence().map { idOf(it.substringAfter(SEPARATOR)) }

    fun clear() = entries.clear()

    private fun key(quadkey: String, id: Id) = "$quadkey$SEPARATOR${textOf(id)}"

    private companion object {
        // Never in a quadkey, which is digits, nor in an id, so where the quadkey ends is never in doubt.
        const val SEPARATOR = '|'
    }
}

/** Which rows each holder has, so that "held by" is answered from the holder's own and not by walking every row. */
internal class HolderIndex<Holder : Any, Id : Any> {
    private val held = ConcurrentHashMap<Holder, MutableSet<Id>>()

    /** The row is now held by [now], and no longer by [was]. */
    fun moved(id: Id, was: Holder?, now: Holder?) {
        if (was == now) return
        was?.let { holder -> held.computeIfPresent(holder) { _, ids -> ids.apply { remove(id) }.ifEmpty { null } } }
        now?.let { holder -> held.computeIfAbsent(holder) { ConcurrentHashMap.newKeySet() }.add(id) }
    }

    fun of(holder: Holder): Set<Id> = held[holder].orEmpty()

    fun clear() = held.clear()
}

/**
 * The cells that between them hold every place within [km] of a place: the one it is in and the eight round it, at the
 * deepest zoom whose cells are twice [km] wide there - twice, because a cell is narrower nearer the pole than at the
 * place, so that no place that near can lie beyond them. Coarser cells hold more; the world is the cell of zoom zero.
 */
internal fun cellsRound(lat: Double, lon: Double, km: Double): List<String> {
    val across = EARTH_KM * cos(Math.toRadians(lat.coerceIn(-MOST_LATITUDE, MOST_LATITUDE)))
    val zoom = (Cell.MAX_ZOOM downTo 0).firstOrNull { across / (1 shl it) >= 2 * km } ?: return listOf("")
    if (zoom == 0) return listOf("")
    val (x, y) = tileOf(Cell.of(lat, lon, zoom).quadkey)
    val tiles = 1 shl zoom
    return (-1..1).flatMap { dy ->
        (-1..1).mapNotNull { dx ->
            val ty = y + dy
            if (ty !in 0 until tiles) null else quadkeyOf(Math.floorMod(x + dx, tiles), ty, zoom)
        }
    }.distinct()
}

private const val EARTH_KM = 40_075.0

// Past it a cell's width shrinks towards nothing; the map's own projection stops at about 85.
private const val MOST_LATITUDE = 85.0

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
    for (level in zoom - 1 downTo 0) append(((x shr level) and 1) + 2 * ((y shr level) and 1))
}
