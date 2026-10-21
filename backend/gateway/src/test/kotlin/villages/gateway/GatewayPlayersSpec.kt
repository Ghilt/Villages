package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.PlayerId
import villages.protocol.ErrorFrame
import villages.protocol.PlayersListed
import villages.protocol.ServerFrame

/** The players of the world through the gateway, for the debug panel to switch players by. See decision record 0101. */
class GatewayPlayersSpec : StringSpec({

    fun asked(rig: Rig): List<ServerFrame> {
        val sent = mutableListOf<ServerFrame>()
        val window = rig.gateway.connect { sent += it }.also { it.receive(hello) }
        sent.clear()
        window.receive("""{"type":"listPlayers"}""")
        return sent
    }

    "every player with a house is listed by the house's name, to the window that asked" {
        val rig = Rig()
        rig.aHouseIsFounded("Ravenscar")
        rig.aHouseIsFounded("Hollin")
        rig.settle()

        val listed = asked(rig).single() as PlayersListed
        listed.players.map { it.house } shouldBe listOf("Hollin", "Ravenscar")
        listed.players.map { it.player } shouldBe listOf("Hollin", "Ravenscar").map { name ->
            rig.houses.everyHouse().single { it.name.value == name }.player.value.toString()
        }
    }

    "the world's own players, its house bots, are listed as such, and a person's are not" {
        val rig = Rig()
        rig.aHouseIsFounded("Ravenscar")
        val london = PlayerId.botAt("Q84")
        rig.world.aBotIsMade(london, "Q84")
        rig.introduced(london.value.toString()).first.receive(founding(name = "London"))
        rig.settle()

        val listed = asked(rig).single() as PlayersListed
        listed.players.map { it.house to it.bot } shouldBe listOf("London" to true, "Ravenscar" to false)
    }

    "closed instruments list nobody" {
        val rig = Rig(instrumentsOpen = false)
        rig.aHouseIsFounded("Ravenscar")
        asked(rig).map { (it as ErrorFrame).code } shouldBe listOf("instrumentsClosed")
    }
})
