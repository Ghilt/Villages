package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import villages.application.Unreadable
import villages.application.WorldKept
import villages.domain.PlayerId
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.ErrorFrame
import villages.protocol.EventFrame
import villages.protocol.ServerFrame
import villages.protocol.Welcome
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

    "closed, the welcome does not say where the world is kept, and open it does" {
        fun welcomeFrom(rig: Rig): Welcome {
            val sent = mutableListOf<ServerFrame>()
            rig.connect { sent += it }.receive(hello)
            return sent.filterIsInstance<Welcome>().single()
        }

        welcomeFrom(Rig(instrumentsOpen = false)).keptIn shouldBe null
        welcomeFrom(Rig()).keptIn shouldBe "in memory, and gone when the server stops"
    }

    "a window is told at hello how many settlements the world has, only while the instruments are open" {
        val counted = villages.protocol.SettlementsNow(sites = 12, standing = 10, passedOver = 1, orphans = 1)
        fun welcomeFrom(rig: Rig): Welcome {
            val sent = mutableListOf<ServerFrame>()
            rig.connect { sent += it }.receive(hello)
            return sent.filterIsInstance<Welcome>().single()
        }

        welcomeFrom(Rig(instrumentsOpen = false, settlements = { counted })).settlements shouldBe null
        welcomeFrom(Rig(settlements = { counted })).settlements shouldBe counted
        welcomeFrom(Rig()).settlements shouldBe null
    }

    "a window is told at hello what the world holds that this code cannot read, only while the instruments are open" {
        val oldShapes = object : WorldKept {
            override val keptIn = "in MongoDB, database villages-a-tree, which outlives the server"

            override fun unreadable() =
                Unreadable(events = 3, of = 120, first = "a villages.house.founded.v1 on house:x (KotlinInvalidNullException)")
        }
        fun errorsAtHello(rig: Rig) = mutableListOf<ServerFrame>()
            .also { sent -> rig.connect { sent += it }.receive(hello) }
            .filterIsInstance<ErrorFrame>()

        val told = errorsAtHello(Rig(worldKept = oldShapes)).single()
        told.code shouldBe "unreadableEvents"
        told.message shouldContain "3 of this world's 120 events cannot be read"
        told.message shouldContain "Wipe this world: the World section, wipe."
        errorsAtHello(Rig(instrumentsOpen = false, worldKept = oldShapes)).shouldBeEmpty()
        errorsAtHello(Rig()).shouldBeEmpty()
    }

    "open, as it is by default, a lever does what it always did" {
        val rig = Rig()
        val (window, sent) = rig.introduced()
        window.receive(founding())

        window.receive(granting())

        sent.filterIsInstance<CommandAccepted>().map { it.commandId } shouldBe listOf(COMMAND_ONE, COMMAND_TWO)
    }

    "open to some windows only, the levers and the looks are refused to every other, and open to those" {
        val adams = UUID.randomUUID().toString()
        val rig = Rig(instrumentsFor = { it?.player == signedInAs(adams).player })
        val (adam, toAdam) = rig.introduced(adams)
        val (other, toOther) = rig.introduced()

        other.receive(founding())
        other.receive(granting())
        other.receive("""{"type":"watchEvents","on":true}""")
        adam.receive(founding(commandId = commandNumber(7)))
        adam.receive("""{"type":"watchEvents","on":true}""")

        toOther.filterIsInstance<CommandRejected>().map { it.reason } shouldBe listOf("instrumentsClosed", "instrumentsClosed")
        toOther.filterIsInstance<ErrorFrame>().single().code shouldBe "instrumentsClosed"
        toAdam.filterIsInstance<CommandAccepted>().map { it.commandId } shouldBe listOf(commandNumber(7))
        toAdam.filterIsInstance<ErrorFrame>().shouldBeEmpty()
    }

    "open to some windows only, playing as somebody else is refused to every other" {
        val rig = Rig(instrumentsFor = { false })
        val sent = mutableListOf<ServerFrame>()

        rig.connect { sent += it }.receive(helloAs(UUID.randomUUID()))

        sent.filterIsInstance<ErrorFrame>().map { it.code } shouldBe listOf("instrumentsClosed")
    }
})
