package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe
import villages.application.FeedFault
import villages.projections.HousesProjection
import villages.protocol.ErrorFrame
import villages.protocol.EventFrame

/** The gateway: watching the stored events, and a subscriber that throws. The rig is GatewayRig.kt. */
class GatewayEventsSpec : StringSpec({

    "a watcher is given what it missed, oldest first, and then what happens next" {
        val rig = Rig()
        val (founder, _) = rig.someoneElse()
        founder.receive(founding())

        // Only now does anyone start watching: everything above happened before this window existed.
        val (watching, watcher) = rig.someoneElse()
        watching.receive("""{"type":"watchEvents","on":true}""")

        // The founder arriving, the founder founding, and the watcher arriving: all before this asked.
        val missed = watcher.filterIsInstance<EventFrame>().map { it.eventType }
        missed shouldBe listOf(
            "villages.player.givenChoice.v1",
            "villages.house.founded.v1",
            "villages.player.givenChoice.v1",
        )

        // And it keeps hearing them as they happen.
        watcher.clear()
        rig.aHouseIsFounded()
        watcher.filterIsInstance<EventFrame>().map { it.eventType } shouldBe listOf(
            "villages.player.givenChoice.v1",
            "villages.house.founded.v1",
        )
    }

    "and one that stops watching is given nothing more" {
        val rig = Rig()
        val (watching, watcher) = rig.introduced()
        watching.receive("""{"type":"watchEvents","on":true}""")
        watching.receive("""{"type":"watchEvents","on":false}""")
        watcher.clear()

        rig.aHouseIsFounded()

        watcher.filterIsInstance<EventFrame>().shouldBeEmpty()
    }

    "a watcher whose socket is closing does not cost the other watchers the event" {
        val rig = Rig()
        val (watching, watcher) = rig.introduced()
        watching.receive("""{"type":"watchEvents","on":true}""")
        rig.someoneLeaving("""{"type":"watchEvents","on":true}""")
        watcher.clear()

        rig.aHouseIsFounded()

        watcher.filterIsInstance<EventFrame>().map { it.eventType } shouldContain "villages.house.founded.v1"
    }

    // The stack is in the server's log; the debug panel in every window is told the one line of it.

    "a subscriber that threw on an event is told to every window as a fault" {
        val rig = Rig()
        val (mine, one) = rig.introduced()
        val (_, two) = rig.someoneElse()
        mine.receive(founding())
        val founded = rig.recent.latest(1).single()
        one.clear()
        two.clear()

        rig.world.fault(FeedFault("HousesProjection", founded, IllegalStateException("a fold that is wrong")))

        val told = ErrorFrame(
            "fault",
            "HousesProjection threw on villages.house.founded.v1 (${founded.stream}, version 2): " +
                "IllegalStateException: a fold that is wrong",
        )
        one.single() shouldBe told
        two.single() shouldBe told
    }
})
