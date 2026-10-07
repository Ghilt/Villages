package villages.protocol

import com.fasterxml.jackson.annotation.JsonInclude

/**
 * What a page points at on the map, asked of the server: a click that hit no house, person or area sends the place,
 * and the answer says what river is there. The server names it only on ground the house has revealed, from the
 * master's ground map and its real names, and never from the page's own copy of the names. See decision record 0087.
 */
data class InspectAt(val at: Point) : ClientFrame

/**
 * The answer to [InspectAt], for the place it asked about: whether the house has revealed it, and the river there, or
 * none - none too where it has not been revealed. A river whose name nobody knows is a river all the same.
 */
data class Inspected(val at: Point, val revealed: Boolean, val river: RiverView?) : ServerFrame

/**
 * A river pointed at: its real identity, a Wikidata id where there is one, and its name in English, with today's
 * beside a name of 1790 the review chose. Neither where no named river is close enough to be the one painted there.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class RiverView(
    val id: String? = null,
    val name: String? = null,
    val also: String? = null,
    val of1790: Boolean = false,
)
