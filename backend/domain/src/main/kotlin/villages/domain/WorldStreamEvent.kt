package villages.domain

import java.time.Instant

/**
 * Everything on the world's own stream, [WORLD_STREAM]: what belongs to no house, character or structure. The
 * world's half, typed `villages.world.<verb>.v<n>`, and every one carries the two times. See decision record 0097.
 */
sealed interface WorldStreamEvent : Event

/**
 * The world took on a version of a catalogue it had not recorded: the first it ever had of it, or a new one. It
 * carries the whole text, so the world's history alone says which numbers were in force at every moment, as an
 * offered quest carries its words. What the change sets right - a house's income, its sight - is written after it by
 * the listeners that write those, in the same story. See decision record 0097.
 */
data class WorldCatalogueChanged(
    /** Its name on the shelf, `world/catalogues/<catalogue>.json`: `structures`, or `dialogues/letter`. */
    val catalogue: String,
    /** The SHA-256 of the file's bytes, in hex. */
    val fingerprint: String,
    /** The fingerprint of the version it replaced, or none for the first. */
    val previous: String?,
    /** Where in the file it differs from the version it replaced, as paths, `types.castle.yields`; none for the first. */
    val changed: List<String>,
    val text: String,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : WorldStreamEvent, WorldEvent
