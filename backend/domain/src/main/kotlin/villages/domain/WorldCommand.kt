package villages.domain

import java.time.Instant

/** The world's own stream: one for the whole world, for what belongs to no house, character or structure. 0097. */
const val WORLD_STREAM = "world"

/**
 * Whether a name is one a catalogue can have on the shelf: lower-case words joined by hyphens, in a folder of such
 * words or none, `structures`, `character-names` or `dialogues/letter`. Nothing that could reach outside the shelf.
 */
fun isCatalogueName(name: String): Boolean = CATALOGUE_NAME.matches(name)

private val CATALOGUE_NAME = Regex("[a-z0-9]+(?:-[a-z0-9]+)*(?:/[a-z0-9]+(?:-[a-z0-9]+)*)?")

/** A request to the world's own stream, named as an imperative. It may be refused, and it is not stored. */
sealed interface WorldCommand

/**
 * Take on a version of a catalogue: [catalogue] is its name on the shelf, `structures` or `dialogues/letter`; [text]
 * is the file whole, as the game server read it and checked it; [fingerprint] is the SHA-256 of its bytes, in hex.
 * Taking on the version the world last recorded changes nothing and writes nothing.
 */
data class TakeOnCatalogue(
    val catalogue: String,
    val text: String,
    val fingerprint: String,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : WorldCommand

/** A house bot: the player the world plays, and the town of 1790, by its id, whose ruin it stands outside. */
data class Bot(val player: PlayerId, val town: String)

/**
 * Make the house bots the world lacks: each is recorded once, and a bot already made, or named twice, writes nothing
 * more. A bot whose player is not the one its town names is refused, so a bot is always [PlayerId.botAt] its town.
 * See decision record 0108.
 */
data class CreateBots(val bots: List<Bot>, val worldTime: WorldTime, val recordedAt: Instant) : WorldCommand
