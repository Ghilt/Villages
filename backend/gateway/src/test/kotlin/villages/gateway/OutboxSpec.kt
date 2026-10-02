package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import villages.protocol.CommandAccepted
import villages.protocol.ErrorFrame
import villages.protocol.EventFrame
import villages.protocol.ProtocolJson
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.StandsFrame
import villages.protocol.YourHouse
import villages.protocol.YourSight
import java.util.concurrent.Executor

/** An outbox whose sending waits until the test says go, so that frames can be seen waiting. */
private class Held {
    val sent = mutableListOf<ServerFrame>()
    private val planned = mutableListOf<Runnable>()
    val outbox = Outbox({ sent += it }, Executor { planned += it })

    fun go() {
        val due = planned.toList()
        planned.clear()
        due.forEach { it.run() }
    }
}

private fun snapshot(cell: String, asOf: Long) = Snapshot(cell, emptyList(), asOf, 0, emptyList(), 0)

private fun event(n: Int) = EventFrame(
    id = "e$n", eventType = "villages.test.happened.v1", stream = "house:x", streamVersion = n.toLong(),
    time = 0, correlationId = "c", causationId = "c", data = ProtocolJson.tree("{}"),
)

/** The one bounded queue every frame to a connection leaves through. See the scale principles in ARCHITECTURE. */
class OutboxSpec : StringSpec({

    "frames go in the order they were queued, one at a time, and a frame that will not send costs the rest nothing" {
        val sent = mutableListOf<ServerFrame>()
        val outbox = Outbox({ frame -> if (frame == CommandAccepted("2")) error("the socket is going") else sent += frame }, Executor { it.run() })

        (1..3).forEach { outbox.send(CommandAccepted("$it")) }

        sent shouldBe listOf(CommandAccepted("1"), CommandAccepted("3"))
    }

    "a snapshot of a cell still waiting is replaced by a newer one of the same cell, in its place" {
        val held = Held()

        held.outbox.send(snapshot("0123", asOf = 1))
        held.outbox.send(CommandAccepted("between"))
        held.outbox.send(snapshot("3210", asOf = 1))
        held.outbox.send(snapshot("0123", asOf = 2))
        held.go()

        held.sent shouldBe listOf(snapshot("0123", asOf = 2), CommandAccepted("between"), snapshot("3210", asOf = 1))
    }

    "a tile of stands and each of the your frames are replaced the same way, and only by their own kind" {
        val held = Held()

        held.outbox.send(StandsFrame(1, 2, "old"))
        held.outbox.send(YourHouse(null))
        held.outbox.send(StandsFrame(2, 1, "other"))
        held.outbox.send(StandsFrame(1, 2, "new"))
        held.outbox.send(YourSight(emptyList(), 0.0))
        held.outbox.send(YourHouse(null))
        held.go()

        held.sent shouldBe listOf(
            StandsFrame(1, 2, "new"), YourHouse(null), StandsFrame(2, 1, "other"), YourSight(emptyList(), 0.0),
        )
    }

    "past the cap a watcher's events are left out, it is told so once, and once caught up it is sent them again" {
        val held = Held()

        (1..MOST_EVENTS_WAITING + 5).forEach { held.outbox.send(event(it)) }
        held.go()

        held.sent shouldHaveSize MOST_EVENTS_WAITING + 1
        held.sent.last().shouldBe(ErrorFrame("eventsLeftOut", "this window fell behind the world, and events were left out"))

        held.outbox.send(event(9999))
        held.go()
        held.sent.last() shouldBe event(9999)
    }

    "a command's answer always goes, however many there are" {
        val held = Held()

        (1..MOST_EVENTS_WAITING * 3).forEach { held.outbox.send(CommandAccepted("$it")) }
        held.go()

        held.sent shouldHaveSize MOST_EVENTS_WAITING * 3
    }
})
