package villages.domain

import java.util.UUID

/**
 * How good a rolled option is. A choice roll rolls one and deals its whole hand at it, so a legendary never sits
 * beside two commons; the odds are the fate engine's, and nothing here knows them. See decision record 0083.
 */
enum class Rarity { COMMON, UNCOMMON, RARE, LEGENDARY }

/**
 * Where an omen came from: the house itself, what changed in it since its last roll, what the page had open,
 * where the player was looking, or the time of year. Said so that the report card can mark each kind alike and a
 * reader of the stream can tell a fact about the house from a fact about the screen.
 */
enum class OmenKind { HOUSE, CHANGE, WINDOW, DIALOGUE, KEY_FIGURE, MAP, SEASON }

/** What names an omen across rolls - `map.river`, `figure:<id>` - so an option can say which ones brought it. */
@JvmInline
value class OmenKey(val value: String) {
    init {
        if (value.isBlank()) {
            throw HouseError.InvalidChoice("an omen is named")
        }
    }
}

/**
 * One thing the fate engine took into account for a roll, with the words the player reads and sometimes a value:
 * *Pious 64*. Recorded whole on the roll, so the stream can say why a hand was what it was for as long as it
 * exists. See decision record 0083.
 */
data class Omen(
    val key: OmenKey,
    val kind: OmenKind,
    val words: String,
    val value: Long? = null,
)

/** The identity of one roll. */
@JvmInline
value class RollId(val value: UUID)

/**
 * Refuses a hand this roll cannot deal: every option is of the rarity rolled, and every omen an option names is
 * one the roll read. A hand that broke either would show the player a reason that is not one.
 */
internal fun Choice.refuseUnlessDealtBy(rarity: Rarity, omens: List<Omen>) {
    if (options.any { it.rarity != rarity }) {
        throw HouseError.InvalidChoice("a rolled hand is all of the rarity rolled, $rarity")
    }
    val read = omens.map(Omen::key).toSet()
    if (options.any { option -> !read.containsAll(option.omens) }) {
        throw HouseError.InvalidChoice("an option names an omen the roll did not read")
    }
}
