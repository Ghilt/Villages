package villages.projections

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentSkipListSet

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
