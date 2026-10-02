package villages.application

/** A `Later` on a timer thread. One thread, because nothing here is heavy and order does not matter. */
class ScheduledLater : Later, AutoCloseable {
    private val timer = java.util.concurrent.Executors.newSingleThreadScheduledExecutor { runnable ->
        Thread(runnable, "villages-later").apply { isDaemon = true }
    }

    override fun schedule(delayMs: Long, action: Runnable) {
        timer.schedule(action, delayMs.coerceAtLeast(0), java.util.concurrent.TimeUnit.MILLISECONDS)
    }

    override fun close() {
        timer.shutdownNow()
    }
}
