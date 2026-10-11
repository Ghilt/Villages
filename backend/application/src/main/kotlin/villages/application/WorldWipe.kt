package villages.application

import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.withLock

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

/**
 * The one moment a wipe takes, which nothing written to the world crosses. A command runs outside it, and so
 * does a reaction's check that its plan is still of this world together with the command it then issues, and so
 * does a follower's reading of the history: each wholly before a wipe or wholly after one, and never half of
 * each. A wipe waits for whatever is under way outside it, and whatever comes meanwhile waits for the wipe.
 * See decision record 0036.
 */
class WipeGate {
    private val lock = ReentrantReadWriteLock()

    /** Runs [act] outside a wipe: after any under way, and before the next begins. Any number at once, and nested. */
    fun <T> outside(act: () -> T): T = lock.readLock().withLock(act)

    /** Runs [wipe] alone, once everything under way outside a wipe is done. */
    fun <T> wiping(wipe: () -> T): T {
        // Asked for from inside a command, a wipe would wait for that command, which would be waiting for it.
        check(lock.readHoldCount == 0) { "a wipe was asked for from inside something it would wait for" }
        return lock.writeLock().withLock(wipe)
    }
}
