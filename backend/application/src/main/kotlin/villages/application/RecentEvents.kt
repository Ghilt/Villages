package villages.application

/**
 * The events the world stored most recently, for reading rather than for folding.
 *
 * A window on the end of the chronicle, not the chronicle: a viewer that opened a moment ago has missed
 * everything, and the world did not begin when it did. Reading the whole store instead would be a scan
 * on every connect and an unbounded frame, which is why this is a read model like any other.
 */
fun interface RecentEvents {
    /** The newest `most` events, oldest first, so a reader receives them in the order they happened. */
    fun latest(most: Int): List<StoredEvent>
}
