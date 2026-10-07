package villages.protocol

import com.fasterxml.jackson.annotation.JsonInclude

/**
 * A window asking after its subject, wherever the camera is: a house or a character by its id, `kind` being
 * `house` or `character`. Sent once, when a window opens on something the page knows nothing of; there is no
 * subscription and nothing is sent again. See decision record 0088.
 */
data class Inspect(val kind: String, val id: String) : ClientFrame

/**
 * The answer to [Inspect], once: the house or the character as the map would show it, or neither when there is
 * no such thing or the fog holds it back - a house on ground the player's house has not revealed, somebody it has
 * never had in its vision - by the same rule a cell's snapshot is held to. Somebody it saw once and does not see
 * now is answered as they were last seen, where they stood; a house or a person the fog has hidden carries the
 * world-day it did as `seenUntil`, on its view as everywhere. See decision records 0061, 0088 and 0089.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class Inspected(
    val kind: String,
    val id: String,
    val house: HouseView? = null,
    val character: CharacterOnMapView? = null,
) : ServerFrame
