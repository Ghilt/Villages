package villages.application

/**
 * Empties the development world: every stream and every read model built from them, gone.
 *
 * Not the wipe of decision record 0011, which is forced by a change to an event on a world that had
 * players in it and belongs in the experiment journal. This one empties an in-memory world that dies at
 * every restart of the server anyway, from a button that is pressed many times a day. It goes, or gains
 * a guard, before the world-persistence milestone. See decision record 0036.
 */
fun interface WorldWipe {
    /** How many events were removed, so that the log line can say what happened rather than that it did. */
    fun wipe(): Int
}
