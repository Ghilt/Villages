package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.protocol.ErrorFrame
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.Welcome
import villages.protocol.WorldNow

/** The gateway: looking at an earlier day. The rig is GatewayRig.kt. */
class GatewayTimelineSpec : StringSpec({

    "welcome's earliest day is the first anything is known to exist from" {
        val rig = Rig()
        rig.aHouseIsFounded()
        val sent = mutableListOf<ServerFrame>()

        rig.connect { sent += it }.receive(hello)

        sent.first().shouldBeInstanceOf<Welcome>().world shouldBe WorldNow(today = today.day, earliest = today.day)
    }

    "looking at a day before a structure was raised, its cell is empty; looking at live again, it is back" {
        val rig = Rig()
        rig.aStructureIsRaised()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z10))
        sent.single().shouldBeInstanceOf<Snapshot>().structures shouldHaveSize 1
        sent.clear()

        looker.receive("""{"type":"viewTime","at":${today.day - 1}}""")
        sent.single().shouldBeInstanceOf<Snapshot>().structures.shouldBeEmpty()
        sent.clear()

        looker.receive("""{"type":"viewTime","at":null}""")
        val back = sent.single().shouldBeInstanceOf<Snapshot>()
        back.structures shouldHaveSize 1
        back.structures.single().since shouldBe today.day
    }

    "a connection looking at the past is not told of a structure raised on a later day" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z10))
        looker.receive("""{"type":"viewTime","at":${today.day - 100}}""")
        sent.clear()

        rig.aStructureIsRaised()
        rig.later.tick()

        sent.shouldBeEmpty()
    }

    "a day before the calendar began is refused" {
        val (looker, sent) = Rig().introduced()

        looker.receive("""{"type":"viewTime","at":-5}""")

        sent.single().shouldBeInstanceOf<ErrorFrame>().code shouldBe "badTime"
    }
})
