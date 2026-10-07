package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.protocol.Inspected
import villages.protocol.ServerFrame
import villages.protocol.YourHouse
import villages.protocol.YourKeyFigures

private fun inspecting(kind: String, id: String) = """{"type":"inspect","kind":"$kind","id":"$id"}"""

/** The single answer to a window asking after its subject. */
private fun MutableList<ServerFrame>.answer(): Inspected = filterIsInstance<Inspected>().single()

/**
 * A window asking after its subject wherever the camera is, answered once by the rule a cell's snapshot is held to:
 * the fog lets through a house on revealed ground and somebody in vision. No cell is held in any of these. See
 * decision record 0087. The rig is GatewayRig.kt.
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

    "somebody in the house's vision is answered as the map shows them, and nobody once they have left it" {
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
        sent.clear()

        theirs.receive(moving(agnes, HELSINKI_LAT, HELSINKI_LON, commandNumber(3)))
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
