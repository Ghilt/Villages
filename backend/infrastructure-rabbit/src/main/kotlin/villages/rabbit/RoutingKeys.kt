package villages.rabbit

import villages.domain.CharacterMoved
import villages.domain.Event
import villages.domain.HouseFounded
import villages.domain.HouseGainedVision
import villages.domain.Location
import villages.domain.StructureRaised

/**
 * The routing key an event is published under: the parts of its type after `villages.`, then the cell of where it
 * happened, a word a digit, so that a tile's binding is its quadkey's digits and `#`: `*.*.*.1.2.0.#` holds
 * everything that happened in tile 120. An event that says nowhere, which most do yet, and one the code cannot
 * read, end in `none`. So `villages.house.founded.v1` at 1203002113 is `house.founded.v1.1.2.0.3.0.0.2.1.1.3`.
 *
 * The cell is worked out by [cellOf], the one function the page and the server share (decision record 0026), which
 * the app hands in so that this module needs nothing of the wire's. See decision record 0094.
 */
class RoutingKeys(private val cellOf: (Location) -> String) {
    /** The key for an event of [type], read as [event], or null when it could not be read. */
    fun of(type: String, event: Event?): String {
        val cell = event?.let(::placeOf)?.let(cellOf).orEmpty()
        val where = if (cell.isEmpty()) NOWHERE else cell.toList().joinToString(".")
        return "${type.removePrefix(PREFIX)}.$where"
    }

    private companion object {
        const val PREFIX = "villages."
        const val NOWHERE = "none"
    }
}

/**
 * Where an event happened, when it says so: the place it carries, whatever the field is called. A new event that
 * carries a place joins this list, and `RoutingKeysSpec` fails until it does.
 */
fun placeOf(event: Event): Location? = when (event) {
    is HouseFounded -> event.seat
    is HouseGainedVision -> event.place
    is CharacterMoved -> event.place
    is StructureRaised -> event.place
    else -> null
}
