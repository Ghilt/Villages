package villages.occurrent

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import java.util.Collections
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread

/**
 * The hand-over from a feed's history to what arrives live: nothing lost, everything in order with the history
 * first, and never two at once. The first two drive it by hand, one interleaving at a time; the last puts the
 * history and the live side on threads of their own, which is where the old hand-over lost an event or handed
 * two together.
 */
class HandoffSpec : StringSpec({

    "what arrives while the history is read is handed on after it, in the order it arrived, then as it arrives" {
        val handed = mutableListOf<String>()
        val handoff = Handoff<String>(replaying = true) { handed += it }

        handoff.replayed("the first written")
        handoff.live("the first live")
        handoff.replayed("the second written")
        handoff.live("the second live")
        handoff.replayDone()
        handoff.live("the third live")

        handed shouldBe listOf("the first written", "the second written", "the first live", "the second live", "the third live")
    }

    "a feed that starts from now hands each event on as it arrives" {
        val handed = mutableListOf<String>()
        val handoff = Handoff<String>(replaying = false) { handed += it }

        handoff.live("now")

        handed shouldBe listOf("now")
    }

    "on threads of their own, nothing is lost, the history comes first, and no two are handed at once" {
        repeat(ROUNDS) {
            val handed = Collections.synchronizedList(mutableListOf<String>())
            val inside = AtomicInteger()
            val most = AtomicInteger()
            val handoff = Handoff<String>(replaying = true) { event ->
                most.accumulateAndGet(inside.incrementAndGet(), ::maxOf)
                handed += event
                repeat(SPIN) { Thread.onSpinWait() }
                inside.decrementAndGet()
            }
            val historyDone = AtomicBoolean(false)
            val arrived = AtomicInteger()
            // The live side keeps arriving across the moment the history ends, which is where the old hand-over
            // lost an event, handed one out of order, or handed two at once.
            val live = thread {
                var n = 0
                while (!historyDone.get()) handoff.live("live ${n++}")
                repeat(AFTER) { handoff.live("live ${n++}") }
                arrived.set(n)
            }
            val history = thread {
                repeat(EACH) { handoff.replayed("written $it") }
                handoff.replayDone()
                historyDone.set(true)
            }
            history.join()
            live.join()

            most.get() shouldBe 1
            handed.size shouldBe EACH + arrived.get()
            handed.take(EACH) shouldBe List(EACH) { "written $it" }
            handed.drop(EACH) shouldBe List(arrived.get()) { "live $it" }
        }
    }
})

private const val ROUNDS = 50
private const val EACH = 2_000
private const val AFTER = 200
private const val SPIN = 20
