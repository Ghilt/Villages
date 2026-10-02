package villages.projections

import villages.application.EventFeed
import villages.application.RecentEvents
import villages.application.StoredEvent
import villages.application.Follower

/**
 * The end of the chronicle, kept so that it can be read.
 *
 * A read model like any other, and the only one that holds events rather than something folded out of
 * them: what it serves is the events themselves, to be looked at. That is why it is bounded. The store
 * holds everything for ever and is where a real chronicle would be read from; this is the window a
 * viewer needs to see what has been happening without asking the store for the world.
 *
 * Disposable, like every read model: delete it, replay the feed, get it back.
 */
class RecentEventsProjection(feed: EventFeed, private val most: Int = RECENT) : Follower(feed), RecentEvents {
    private val lock = Any()
    private val held = ArrayDeque<StoredEvent>()

    override fun apply(stored: StoredEvent) {
        synchronized(lock) {
            held.addLast(stored)
            while (held.size > most) {
                held.removeFirst()
            }
        }
    }

    override fun latest(most: Int): List<StoredEvent> = synchronized(lock) {
        held.takeLast(most.coerceAtLeast(0))
    }

    /** How many are held, for the debug panel and for tests. */
    val size: Int get() = synchronized(lock) { held.size }

    /** Forgets them, because the world they happened in has been emptied. See decision record 0036. */
    override fun reset() {
        synchronized(lock) { held.clear() }
    }

    companion object {
        /**
         * How much of the end of the chronicle is kept.
         *
         * Enough that opening the viewer shows the session you have been playing, and bounded because a
         * read model that grows with the world is a leak. When the whole chronicle is wanted it will be
         * read from the store, paged, which is a different thing and is not this.
         */
        const val RECENT = 100
    }
}
