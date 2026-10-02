package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Whatever is scheduled for later and throws is said, rather than kept in a future nobody reads; and the timer
 * goes on to what is scheduled after it. On a real timer thread, because that is where the throw used to vanish.
 */
class ScheduledLaterSpec : StringSpec({

    "an action that throws is said to the faults, as the thread's name, and the next action still runs" {
        val faults = FaultBoard()
        val said = CopyOnWriteArrayList<Fault>()
        val ran = CountDownLatch(1)
        ScheduledLater(faults, "a test's later").use { later ->
            faults.watch { said += it }.use {
                later.schedule(0) { error("a pledge that could not come back") }
                later.schedule(0) { ran.countDown() }

                ran.await(5, TimeUnit.SECONDS) shouldBe true
            }
        }

        said.single().describe() shouldBe "a test's later threw: IllegalStateException: a pledge that could not come back"
    }
})
