package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.domain.WorldTime
import villages.protocol.Batch
import villages.protocol.HouseChanged
import villages.protocol.Inspected
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.YourHouse
import villages.protocol.YourKeyFigures
import villages.protocol.YourSight

private fun inspecting(kind: String, id: String) = """{"type":"inspect","kind":"$kind","id":"$id"}"""

/** The single answer to a window asking after its subject. */
private fun MutableList<ServerFrame>.answer(): Inspected = filterIsInstance<Inspected>().single()

/**
 * A window asking after its subject wherever the camera is, answered once by the rule a cell's snapshot is held to:
 * the fog lets through a house on revealed ground and somebody in vision. No cell is held in any of these. See
 * decision record 0088. The rig is GatewayRig.kt.
 */
class GatewayInspectingSpec : StringSpec({

    "a house on ground the player's house has revealed is answered whole, with no cell held" {
        val rig = Rig()
        val (theirs, told) = rig.someoneElse()
        theirs.receive(founding(name = "Kestrel", lat = 59.40, lon = 18.20))
        val kestrel = told.filterIsInstance<YourHouse>().last().yours!!.house
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        sent.clear()

        mine.receive(inspecting("house", kestrel.id))

        sent.answer() shouldBe Inspected("house", kestrel.id, house = kestrel)
    }

    "a house on ground it has never seen is held back, and answered once the fog is lifted" {
        val rig = Rig()
        val (theirs, told) = rig.someoneElse()
        theirs.receive(founding(name = "Kestrel", lat = HELSINKI_LAT, lon = HELSINKI_LON))
        val kestrel = told.filterIsInstance<YourHouse>().last().yours!!.house
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        sent.clear()

        mine.receive(inspecting("house", kestrel.id))
        sent.answer() shouldBe Inspected("house", kestrel.id)
        sent.clear()

        mine.receive(fogOfWar(false))
        sent.clear()
        mine.receive(inspecting("house", kestrel.id))
        sent.answer().house?.name shouldBe "Kestrel"
    }

    // The gateway says it, wherever the house is sent from - a cell, a change to it, a window's answer - and the
    // page shows what it is told: a house's sight changing is the cell answered again, so nothing more is sent.
    "a house on ground no longer in vision is sent with the day the fog hid it: by its cell, its changes, a window" {
        val rig = Rig()
        val (theirs, _) = rig.someoneElse()
        theirs.receive(founding(name = "Kestrel", lat = HELSINKI_LAT, lon = HELSINKI_LON))
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(subscribe(HELSINKI_Z10))
        mine.receive(givingVision(HELSINKI_LAT, HELSINKI_LON, commandNumber(1)))
        sent.filterIsInstance<Snapshot>().last().houses.single().seenUntil shouldBe null
        val given = sent.filterIsInstance<YourSight>().last().points.last().of!!
        rig.day = WorldTime(today.day + 30)
        sent.clear()

        mine.receive(takingVision(given, commandNumber(2)))
        val kestrel = sent.filterIsInstance<Snapshot>().single().houses.single()
        kestrel.seenUntil shouldBe today.day + 30
        sent.clear()

        theirs.receive(granting())
        rig.later.tick()
        sent.filterIsInstance<Batch>().single().deltas.single()
            .shouldBeInstanceOf<HouseChanged>().house.seenUntil shouldBe today.day + 30
        sent.clear()

        mine.receive(inspecting("house", kestrel.id))
        sent.answer().house?.seenUntil shouldBe today.day + 30
    }

    "somebody in the house's vision is answered as the map shows them, as they are now" {
        val rig = Rig()
        val (theirs, told) = rig.someoneElse()
        theirs.receive(founding(name = "Kestrel", lat = HELSINKI_LAT, lon = HELSINKI_LON))
        theirs.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = told.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        theirs.receive(moving(agnes, 59.35, 18.10, commandNumber(2)))
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        sent.clear()

        mine.receive(inspecting("character", agnes))

        sent.answer().character?.place?.lat shouldBe 59.35
        sent.answer().character?.seenUntil shouldBe null
    }

    // The window says when the fog hid them, and shows them where they stood then rather than where they went.
    "somebody who has left the house's vision is answered as last seen, with the day the fog hid them" {
        val rig = Rig()
        val (theirs, told) = rig.someoneElse()
        theirs.receive(founding(name = "Kestrel", lat = HELSINKI_LAT, lon = HELSINKI_LON))
        theirs.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = told.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        theirs.receive(moving(agnes, 59.35, 18.10, commandNumber(2)))
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        rig.day = WorldTime(today.day + 30)
        theirs.receive(moving(agnes, HELSINKI_LAT, HELSINKI_LON, commandNumber(3)))
        sent.clear()

        mine.receive(inspecting("character", agnes))

        sent.answer().character?.place?.lat shouldBe 59.35
        sent.answer().character?.seenUntil shouldBe today.day + 30
    }

    // A day is most of an hour, and somebody walked through the house's vision and out again within one was seen.
    "somebody who passed through the house's vision within a day is answered as seen, hidden that same day" {
        val rig = Rig()
        val (theirs, told) = rig.someoneElse()
        theirs.receive(founding(name = "Kestrel", lat = HELSINKI_LAT, lon = HELSINKI_LON))
        theirs.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = told.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        theirs.receive(moving(agnes, 59.35, 18.10, commandNumber(2)))
        theirs.receive(moving(agnes, HELSINKI_LAT, HELSINKI_LON, commandNumber(3)))
        sent.clear()

        mine.receive(inspecting("character", agnes))

        sent.answer().character?.place?.lat shouldBe 59.35
        sent.answer().character?.seenUntil shouldBe today.day
    }

    "somebody the house has never had in its vision is answered with nobody" {
        val rig = Rig()
        val (theirs, told) = rig.someoneElse()
        theirs.receive(founding(name = "Kestrel", lat = HELSINKI_LAT, lon = HELSINKI_LON))
        theirs.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = told.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        theirs.receive(moving(agnes, HELSINKI_LAT, HELSINKI_LON, commandNumber(2)))
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        sent.clear()

        mine.receive(inspecting("character", agnes))

        sent.answer() shouldBe Inspected("character", agnes)
    }

    "an id that is no id, a kind that is no kind, and a thing there is none of are each answered with nothing" {
        val rig = Rig()
        val (mine, sent) = rig.introduced(fogLifted = true)
        val nobody = "00000000-0000-0000-0000-000000000000"

        mine.receive(inspecting("house", "not-an-id"))
        mine.receive(inspecting("castle", nobody))
        mine.receive(inspecting("house", nobody))

        sent.filterIsInstance<Inspected>() shouldBe listOf(
            Inspected("house", "not-an-id"),
            Inspected("castle", nobody),
            Inspected("house", nobody),
        )
    }
})
