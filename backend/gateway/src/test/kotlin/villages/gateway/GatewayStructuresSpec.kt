package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.comparables.shouldBeGreaterThanOrEqualTo
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.domain.HouseId
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.StructureRaised
import villages.domain.StructureId
import villages.domain.StructureType
import villages.protocol.Batch
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.Snapshot
import villages.protocol.StructureArrived
import java.util.UUID

private fun raising(type: String, yours: Boolean, commandId: String = commandNumber(7), lat: Double = 54.36, lon: Double = 18.64) =
    """{"type":"command","commandId":"$commandId","command":{"type":"raiseStructure","structureType":"$type",""" +
        """"level":1,"place":{"lat":$lat,"lon":$lon},"yours":$yours}}"""

private fun raisingAntarctica(commandId: String = commandNumber(8)) =
    """{"type":"command","commandId":"$commandId","command":{"type":"raiseAntarctica"}}"""

/** Adam's levers for structures, as the gateway takes them. See docs/plans/structures.md. */
class GatewayStructuresSpec : StringSpec({

    "raise here raises one where the panel looks, the sender's own house's, under an id from the player and the command" {
        val rig = Rig()
        val (window, sent) = rig.introduced()
        window.receive(founding())

        window.receive(raising("mill", yours = true))

        sent.filterIsInstance<CommandAccepted>().last().commandId shouldBe commandNumber(7)
        val player = PlayerId(UUID.fromString(TOKEN))
        val raised = rig.world.structureEvents.single() as StructureRaised
        raised.structureId shouldBe StructureId.raisedBy(player, UUID.fromString(commandNumber(7)))
        listOf(raised.structureType, raised.place, raised.level, raised.holder) shouldBe
            listOf(StructureType("mill"), Location(54.36, 18.64), 1, HouseId.of(player))
    }

    "a type that is not even a name is malformed, and raises nothing" {
        val rig = Rig()
        val (window, sent) = rig.introduced()

        window.receive(raising("Printing house", yours = false))

        sent.filterIsInstance<CommandRejected>().single().reason shouldStartWith "malformed"
        rig.world.structureEvents.shouldBeEmpty()
    }

    "Antarctica raises every type of the catalogue again" {
        val rig = Rig()
        val (window, _) = rig.introduced()

        window.receive(raisingAntarctica())

        rig.world.structureEvents.map { it.structureId } shouldBe
            listOf("castle", "mill").map { StructureId.inAntarctica(StructureType(it)) }
    }

    "closed, both levers are refused, and nothing is raised" {
        val rig = Rig(instrumentsOpen = false)
        val (window, sent) = rig.introduced()

        window.receive(raising("mill", yours = false))
        window.receive(raisingAntarctica())

        sent.filterIsInstance<CommandRejected>().map { it.reason } shouldBe List(2) { "instrumentsClosed" }
        rig.world.structureEvents.shouldBeEmpty()
    }

    "a cell's snapshot carries the structures standing in it, and the count a page holds its copies against" {
        val rig = Rig()
        val (window, sent) = rig.introduced(fogLifted = true)
        window.receive(raising("mill", yours = false, lat = 59.33, lon = 18.07))
        sent.clear()

        window.receive(subscribe(STOCKHOLM_Z10))

        val snapshot = sent.filterIsInstance<Snapshot>().single()
        val mill = snapshot.structures.single()
        listOf(mill.structureType, mill.name, mill.cell.take(10), mill.holder) shouldBe listOf("mill", "a new mill", STOCKHOLM_Z10, null)
        snapshot.structuresAsOf shouldBeGreaterThanOrEqualTo mill.stamp
    }

    "one raised after taking the cell arrives once the batch closes, its holder named for its pennant" {
        val rig = Rig()
        val (window, sent) = rig.introduced(fogLifted = true)
        window.receive(founding())
        window.receive(subscribe(STOCKHOLM_Z10))
        rig.later.tick()
        sent.clear()

        window.receive(raising("mill", yours = true, lat = 59.33, lon = 18.07))
        rig.later.tick()

        val arrived = sent.filterIsInstance<Batch>().single().deltas.single().shouldBeInstanceOf<StructureArrived>()
        arrived.structure.holder?.name shouldBe "Ravenscar"
        arrived.structure.seenUntil shouldBe null
    }
})
