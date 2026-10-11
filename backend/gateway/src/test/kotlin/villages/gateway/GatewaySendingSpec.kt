package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.protocol.Batch
import villages.protocol.CommandAccepted
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.StructureArrived
import villages.protocol.YourChoice
import villages.protocol.YourHoldings
import villages.protocol.YourHouse
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

/** Waits for something to be true of what a window has heard, or fails saying what it waited for. */
private fun List<ServerFrame>.waitFor(what: String, ready: (List<ServerFrame>) -> Boolean) {
    val giveUp = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
    while (System.nanoTime() < giveUp) {
        if (ready(this)) return
        Thread.sleep(10)
    }
    throw AssertionError("waited for $what and never saw it; heard $this")
}

/**
 * The gateway on threads of its own to send on, as the app wires it: a socket that will not take a frame holds up
 * its own connection and nothing else. See decision record 0077.
 */
class GatewaySendingSpec : StringSpec({

    "a socket that will not take a frame holds up neither the world nor anybody else, and is caught up after" {
        val threads = Executors.newCachedThreadPool()
        // Every send to the slow window waits for this, once it is stuck.
        val letGo = CountDownLatch(1)
        try {
            val rig = Rig(sendOn = threads)

            // One window that takes every frame it is given, looking at Stockholm.
            val heard = CopyOnWriteArrayList<ServerFrame>()
            val fast = rig.gateway.connect { heard += it }
            fast.receive("""{"type":"hello","playerToken":"${UUID.randomUUID()}","protocolVersion":$PROTOCOL_VERSION}""")
            fast.receive(fogOfWar(false))
            fast.receive(subscribe(STOCKHOLM_Z10))
            heard.waitFor("the fast window's snapshot") { frames -> frames.any { it is Snapshot } }

            // And one that stops taking frames once it has arrived: whatever is sent to it then waits.
            val stuckHeard = CopyOnWriteArrayList<ServerFrame>()
            val stuck = AtomicBoolean(false)
            val slow = rig.gateway.connect { frame ->
                if (stuck.get()) letGo.await()
                stuckHeard += frame
            }
            slow.receive("""{"type":"hello","playerToken":"${UUID.randomUUID()}","protocolVersion":$PROTOCOL_VERSION}""")
            stuckHeard.waitFor("the slow window's choice") { frames -> frames.any { it is YourChoice } }
            stuck.set(true)

            // The slow window founds a house there and raises a mill of its own. Its own house and holdings are sent to
            // it from the read models' watchers, which here are the thread the command is decided on: sent on that
            // thread to the stuck socket, the command would wait with it, and the world with the command.
            val acting = thread(isDaemon = true) {
                slow.receive(founding())
                slow.receive(raising("mill", yours = true, lat = 59.33, lon = 18.07))
            }
            acting.join(TimeUnit.SECONDS.toMillis(5))
            acting.isAlive shouldBe false

            // And the mill arrives for everybody else holding its cell, while the slow window still waits.
            rig.later.tick()
            heard.waitFor("the mill arriving at the fast window") { frames ->
                frames.filterIsInstance<Batch>().any { batch -> batch.deltas.any { it is StructureArrived } }
            }
            stuckHeard.none { it is CommandAccepted } shouldBe true

            letGo.countDown()
            stuckHeard.waitFor("the slow window caught up: its house, its holdings, and both commands answered") { frames ->
                frames.count { it is CommandAccepted } == 2 && frames.filterIsInstance<YourHouse>().last().yours != null &&
                    frames.filterIsInstance<YourHoldings>().last().holdings.isNotEmpty()
            }
        } finally {
            letGo.countDown()
            threads.shutdownNow()
        }
    }

    "a window's cells answered again for a change made while the last answer is still to come are answered once" {
        val held = mutableListOf<Runnable>()
        val rig = Rig(sendOn = { held += it })
        val sent = CopyOnWriteArrayList<ServerFrame>()
        val window = rig.gateway.connect { sent += it }
        window.receive(hello)
        window.receive(subscribe(STOCKHOLM_Z10))
        while (held.isNotEmpty()) held.removeAt(0).run()
        sent.clear()

        window.receive(fogOfWar(false))
        window.receive(seeAll(true))
        window.receive(fogOfWar(true))
        while (held.isNotEmpty()) held.removeAt(0).run()

        sent.filterIsInstance<Snapshot>().size shouldBe 1
        sent.any { it is YourChoice } shouldBe false
    }
})
