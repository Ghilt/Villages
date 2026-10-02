package villages.application

/**
 * Something that folds the feed from its beginning: a read model, or a listener that acts on what it hears.
 * From the beginning, because it is its fold of every event, and one it never saw is one it is wrong about for
 * good.
 *
 * It subscribes when it is started and not when it is made. A subscription made in a constructor hands the
 * history to a fold whose fields further down are not there yet, and it takes the moment away from whoever
 * wires it. The app starts each one as its bean is made, `initMethod = "start"`, and a test starts it as the app
 * would, with [started]. Once only, because two subscriptions would fold every event twice.
 *
 * Whatever it folded it forgets on a wipe, [Resettable]: the store is empty, and so must be everything built from
 * it. See decision records 0029 and 0036.
 */
abstract class Follower(private val feed: EventFeed) : Resettable, AutoCloseable {
    private val lock = Any()
    private var started = false
    private var subscription: AutoCloseable? = null

    /** Subscribes from the beginning. The history is folded before this returns, and then whatever is appended. */
    fun start() {
        synchronized(lock) {
            check(!started) { "${javaClass.simpleName} is started already" }
            started = true
            subscription = feed.subscribe(Start.FROM_THE_BEGINNING, ::apply)
        }
    }

    /** Whether it has been started: what the app's own test asks of every follower it is made of. */
    val isStarted: Boolean
        get() = synchronized(lock) { started }

    /** Folds one stored event. The feed hands them on one at a time and in order, the history first. */
    protected abstract fun apply(stored: StoredEvent)

    /**
     * Hands it one event as the feed would, for the tests of a listener that hand it an event the world never
     * wrote: a house that is no longer there, say. Internal, so nothing outside this module can.
     */
    internal fun hear(stored: StoredEvent) = apply(stored)

    override fun close() {
        synchronized(lock) {
            subscription?.close()
            subscription = null
        }
    }
}

/**
 * Something built from the store that forgets all of it when the store is emptied, so that nothing is left
 * holding a house whose events are gone. The development world's wipe resets every one there is. See decision
 * record 0036.
 */
fun interface Resettable {
    fun reset()
}

/** Starts it and hands it back, for wiring that makes and starts a follower in one expression. */
fun <F : Follower> F.started(): F {
    start()
    return this
}
