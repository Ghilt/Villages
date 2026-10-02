package villages.application

import java.util.concurrent.CopyOnWriteArraySet

/**
 * Where anything that acts on its own says it threw.
 *
 * A subscriber to the feed, a listener acting on what it heard, and whatever was scheduled for later all run
 * where nobody is waiting for an answer, so a throw there was lost without a word: a read model missing an
 * event, or a pledge that never came back, and nothing to say why. Reported here, it reaches the server's log
 * with its stack, and every window's debug panel as one line. See decision record 0029.
 */
interface Faults {
    fun report(fault: Fault)

    /** Hears of every fault until the returned handle is closed. */
    fun watch(listener: (Fault) -> Unit): AutoCloseable
}

/** What threw: who, on what when it was acting on something, and what it threw. */
data class Fault(val source: String, val about: String?, val thrown: Throwable) {
    /** The fault in one line, said the same in the server's log and in the debug panel. */
    fun describe(): String =
        "$source threw" + (about?.let { " on $it" } ?: "") + ": " +
            thrown.javaClass.simpleName + (thrown.message?.let { ": $it" } ?: "")

    companion object {
        /** A subscriber to the feed that threw on an event, said as a feed's fault always was. */
        fun onEvent(subscriber: String, event: StoredEvent, thrown: Throwable): Fault =
            Fault(subscriber, "${event.type} (${event.stream}, version ${event.streamVersion})", thrown)
    }
}

/** Faults as a board that anything may write on and anything may watch. */
class FaultBoard : Faults {
    private val listeners = CopyOnWriteArraySet<(Fault) -> Unit>()

    override fun report(fault: Fault) {
        listeners.forEach { it(fault) }
    }

    override fun watch(listener: (Fault) -> Unit): AutoCloseable {
        listeners += listener
        return AutoCloseable { listeners -= listener }
    }
}
