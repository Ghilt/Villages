package villages.domain

import java.time.Instant

/** The world's own stream: one for the whole world, for what belongs to no house, character or structure. 0097. */
const val WORLD_STREAM = "world"

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
