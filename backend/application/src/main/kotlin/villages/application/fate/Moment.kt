package villages.application.fate

import villages.application.HouseRow
import villages.domain.CharacterId
import villages.domain.DialogueId
import villages.domain.HouseId
import villages.domain.Location
import villages.domain.Omen
import villages.domain.WorldTime

/**
 * What the page says it is looking at when the player presses Take action, and nothing it could work out for
 * itself: where the view is centred and how close, which inspect windows are open, which dialogue, which key
 * figure. Every field is a claim, which the omen source that reads it checks against the house's own and the
 * fog. See decision record 0084.
 */
data class Looking(
    val centre: Location? = null,
    val zoom: Double? = null,
    val inspectingHouses: List<HouseId> = emptyList(),
    val inspectingCharacters: List<CharacterId> = emptyList(),
    /** Where each window open on water was opened: the places, which the server reads for the water again. */
    val inspectingWaters: List<Location> = emptyList(),
    val dialogue: DialogueId? = null,
    val figure: CharacterId? = null,
    /** The world the page draws, by its master's name, as it said at hello: whose ground the circle is read on. */
    val master: String? = null,
) {
    companion object {
        val NOTHING = Looking()
    }
}

/** The moment a roll is made at: whose house, as the map's read model holds it, what the page is looking at, and the day. */
data class Moment(
    val house: HouseRow,
    val looking: Looking,
    val today: WorldTime,
)

/**
 * One place the fate engine asks for omens: the house, what changed since its last roll, the page's windows, the
 * ground, the season. A new system that wants to colour the rolls adds a source and nothing else. A source drops
 * whatever it cannot vouch for rather than refusing the roll. See `ARCHITECTURE.md`, the fate engine.
 */
fun interface OmenSource {
    fun read(moment: Moment): List<Omen>
}
