package villages.occurrent

/**
 * The hand-over from a feed's replay of history to what arrives live, for one subscription.
 *
 * The subscription listens before the replay begins, so nothing appended in between is missed, and what arrives
 * live while the history is still being read waits its turn behind it. Three things have to hold, and one lock
 * holds all three. Nothing that arrives is lost: the live side can no longer see "replaying" and then queue an
 * event after the queue was emptied for the last time. Everything is handed on in order, the history first. And
 * never two at once, because a read model's fold is written for one event at a time. See decision record 0029.
 */
internal class Handoff<T>(replaying: Boolean, private val hand: (T) -> Unit) {
    private val lock = Any()
    private var replaying = replaying
    private val waiting = ArrayDeque<T>()

    /** An event as it is appended: handed on now, or kept until the history is done. */
    fun live(event: T) {
        synchronized(lock) {
            if (replaying) waiting.addLast(event) else hand(event)
        }
    }

    /** An event of the history, in the order it was written. */
    fun replayed(event: T) {
        synchronized(lock) { hand(event) }
    }

    /** The history is all handed on: what arrived meanwhile follows it, in the order it arrived. */
    fun replayDone() {
        synchronized(lock) {
            while (waiting.isNotEmpty()) hand(waiting.removeFirst())
            replaying = false
        }
    }
}
