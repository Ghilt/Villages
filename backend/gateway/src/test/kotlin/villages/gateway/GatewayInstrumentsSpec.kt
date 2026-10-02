package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import villages.domain.PlayerId
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.ErrorFrame
import villages.protocol.EventFrame
import villages.protocol.WorldWiped
import java.util.UUID

/**
 * The instruments: Adam's levers and looks, as one part of the gateway, and the one setting that closes all of
 * them while the player's own commands go on. See decision record 0076.
 */
class GatewayInstrumentsSpec : StringSpec({

    "closed, every lever is refused as instrumentsClosed, and nothing is written" {
        val rig = Rig(instrumentsOpen = false)
        val (window, sent) = rig.introduced()
        val written = rig.world.events.size

        window.receive(granting())
        window.receive(founding(commandId = commandNumber(3)))
        window.receive(addingAKeyFigure(commandNumber(4)))
        window.receive(givingVision(60.17, 24.94, commandNumber(5)))
        window.receive(offering("letter", commandNumber(6)))

        sent.filterIsInstance<CommandRejected>().map { it.reason }.toSet() shouldBe setOf("instrumentsClosed")
        sent.filterIsInstance<CommandRejected>() shouldHaveSize 5
        rig.world.events.size shouldBe written
    }

    "closed, the player's own commands go on: the founding choice is taken and the house founded" {
        val rig = Rig(instrumentsOpen = false)
        val (window, sent) = rig.introduced()
        val choice = rig.pending()!!

        window.receive(takingAction(choice.id.value.toString(), choice.options[0].id.value.toString()))

        sent.filterIsInstance<CommandAccepted>().single().commandId shouldBe COMMAND_ONE
        rig.houses.ofPlayer(PlayerId(UUID.fromString(TOKEN))) shouldNotBe null
    }

    "closed, each of the four looks is answered instrumentsClosed, and the world is not emptied" {
        val rig = Rig(instrumentsOpen = false)
        val (window, sent) = rig.introduced()
        val choice = rig.pending()!!

        window.receive("""{"type":"watchEvents","on":true}""")
        window.receive(seeAll(true))
        window.receive(fogOfWar(false))
        // Something happens that a watcher would be sent, and then there is a house for a wipe to take.
        window.receive(takingAction(choice.id.value.toString(), choice.options[0].id.value.toString()))
        window.receive("""{"type":"wipeWorld"}""")

        sent.filterIsInstance<ErrorFrame>().map { it.code } shouldBe List(4) { "instrumentsClosed" }
        sent.filterIsInstance<EventFrame>().shouldBeEmpty()
        sent.filterIsInstance<WorldWiped>().shouldBeEmpty()
        rig.houses.ofPlayer(PlayerId(UUID.fromString(TOKEN))) shouldNotBe null
    }

    "open, as it is by default, a lever does what it always did" {
        val rig = Rig()
        val (window, sent) = rig.introduced()
        window.receive(founding())

        window.receive(granting())

        sent.filterIsInstance<CommandAccepted>().map { it.commandId } shouldBe listOf(COMMAND_ONE, COMMAND_TWO)
    }
})
