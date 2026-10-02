package villages.application

import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * A `Later` on a timer thread. One thread, because nothing here is heavy and order does not matter.
 *
 * Whatever an action throws is said to `faults`, as the thread's name, because the timer would otherwise keep it
 * in a future nobody reads: a pledge that never came back, and not a word about why.
 */
class ScheduledLater(private val faults: Faults, private val name: String = "villages-later") : Later, AutoCloseable {
    private val timer = Executors.newSingleThreadScheduledExecutor { runnable ->
        Thread(runnable, name).apply { isDaemon = true }
    }

    override fun schedule(delayMs: Long, action: Runnable) {
        timer.schedule(
            {
                try {
                    action.run()
                } catch (@Suppress("TooGenericExceptionCaught") thrown: Exception) {
                    faults.report(Fault(name, null, thrown))
                }
            },
            delayMs.coerceAtLeast(0),
            TimeUnit.MILLISECONDS,
        )
    }

    override fun close() {
        timer.shutdownNow()
    }
}
