package villages.gateway

import java.util.concurrent.ConcurrentHashMap

/**
 * Which connections hold each cell: the whole of the fan-out index.
 *
 * Holding and letting go are each one step on the cell, so a connection taking a cell up while another lets the
 * last of it go cannot add itself to a set the index has just dropped; and a cell nobody holds any more leaves the
 * index rather than staying as an empty set for ever.
 */
internal class CellIndex<C : Any> {
    private val holding = ConcurrentHashMap<String, MutableSet<C>>()

    fun hold(cell: String, by: C) {
        holding.compute(cell) { _, holders -> (holders ?: ConcurrentHashMap.newKeySet()).apply { add(by) } }
    }

    fun letGo(cell: String, by: C) {
        holding.computeIfPresent(cell) { _, holders -> holders.apply { remove(by) }.takeIf { it.isNotEmpty() } }
    }

    /** Who holds the cell, or null when nobody does. */
    fun holders(cell: String): Set<C>? = holding[cell]

    /** How many cells somebody holds, for the tests that hold the index to letting go. */
    val size: Int get() = holding.size
}
