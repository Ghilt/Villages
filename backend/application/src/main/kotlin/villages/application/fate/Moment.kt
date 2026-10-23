package villages.application.fate

import villages.application.HouseRow
import villages.domain.CharacterId
import villages.domain.DialogueId
import villages.domain.HouseId
import villages.domain.Location
import villages.domain.Omen
import villages.domain.WorldTime
import java.time.Instant

/**
 * What the page says it is looking at when the player presses Take action, and nothing it could work out for
 * itself: where its die landed, which inspect windows are open, which dialogue, which key figure. Every field is a
 * claim, which the omen source that reads it checks against the house's own and the fog. See decision records 0084
 * and 0118.
 */
data class Looking(
    /** Where the roll's die came to rest: the middle of the landing circle the map's omens are read in. */
    val landing: Location? = null,
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

/**
 * The moment a roll is made at: whose house, as the map's read model holds it, what the page is looking at, the day,
 * the instant, which a stock running at a rate is read at, and how many kilometres round the landing the map's omens
 * are read, the balance's at this moment, so the width read and the width recorded are one number. See 0118.
 */
data class Moment(
    val house: HouseRow,
    val looking: Looking,
    val today: WorldTime,
    val now: Instant,
    val circleKm: Double,
)

/**
 * One place the fate engine asks for omens: the house, what changed since its last roll, the page's windows, the
 * ground, the season. A new system that wants to colour the rolls adds a source and nothing else. A source drops
 * whatever it cannot vouch for rather than refusing the roll. See `ARCHITECTURE.md`, the fate engine.
 */
fun interface OmenSource {
    fun read(moment: Moment): List<Omen>
}
