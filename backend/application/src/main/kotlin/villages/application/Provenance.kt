package villages.application

import java.util.UUID

/**
 * Where a command came from, so that the events it causes can say so.
 *
 * Provenance is a fact about messages rather than about the game, so it travels beside a command rather
 * than inside it, and it lands on the envelope rather than in the event's data. The first message of a
 * story is its own correlation: `Provenance(id, id)`. See decision record 0035.
 */
data class Provenance(
    /** The command's own id, which becomes the causation of every event it writes. */
    val commandId: UUID,
    /** The story the command continues. The server decides this; a client never names it. */
    val correlationId: UUID,
) {
    companion object {
        /** A command that starts a story of its own. */
        fun startedBy(commandId: UUID): Provenance = Provenance(commandId, commandId)

        /**
         * A command issued on hearing [cause], continuing the story of [story]: one event, unless what set it off
         * is not what began it, as a tie made to somebody already dead is not their death. What a listener acting
         * on its own writes with, so the event list reads what it heard and what it did as one thing.
         */
        fun continuing(story: StoredEvent, cause: StoredEvent = story): Provenance = Provenance(
            commandId = UUID.fromString(cause.id),
            correlationId = storyOf(story) ?: UUID.fromString(story.id),
        )

        /** The story an event belongs to, when its correlation is one this server could have written. */
        fun storyOf(event: StoredEvent): UUID? = runCatching { UUID.fromString(event.correlationId) }.getOrNull()
    }
}
