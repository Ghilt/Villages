package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import villages.application.fate.ROLL_PRICE
import villages.domain.FOUNDING_WEALTH
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.RollDrawn
import villages.protocol.YourChoice
import villages.protocol.YourHouse

/** Take action through the gateway: a roll paid for and answered with its hand, and Adam's lever on its luck. See 0083. */
class GatewayRollsSpec : StringSpec({
    fun rolling(commandId: String) =
        """{"type":"command","commandId":"$commandId","command":{"type":"roll","centre":{"lat":59.33,"lon":18.07},"zoom":8}}"""

    fun nextRarity(rarity: String, commandId: String) =
        """{"type":"command","commandId":"$commandId","command":{"type":"nextRarity","rarity":"$rarity"}}"""

    "Take action is paid for, and answered with a hand of one rarity and the omens it read" {
        val rig = Rig()
        val (player, sent) = rig.introduced()
        player.receive(founding())

        player.receive(rolling(COMMAND_TWO))

        sent shouldContain CommandAccepted(COMMAND_TWO)
        val hand = sent.filterIsInstance<YourChoice>().last().choice!!
        hand.options shouldHaveSize 3
        hand.options.map { it.rarity }.toSet() shouldBe setOf("common")
        hand.omens.map { it.words } shouldBe listOf("Holdings in the northern reaches", "Weak house")
        sent.filterIsInstance<YourHouse>().last().yours!!.resources.getValue("wealth").total shouldBe
            FOUNDING_WEALTH - ROLL_PRICE.amount
    }

    "a second Take action before the hand is answered is refused, and nothing is paid for it" {
        val rig = Rig()
        val (player, sent) = rig.introduced()
        player.receive(founding())
        player.receive(rolling(COMMAND_TWO))

        player.receive(rolling(COMMAND_THREE))

        sent.last() shouldBe CommandRejected(COMMAND_THREE, "choicePending")
        sent.filterIsInstance<YourHouse>().last().yours!!.resources.getValue("wealth").total shouldBe
            FOUNDING_WEALTH - ROLL_PRICE.amount
    }

    "a house without the price free cannot roll" {
        val rig = Rig()
        val (player, sent) = rig.introduced()
        player.receive(founding())
        player.receive(spending(amount = FOUNDING_WEALTH - ROLL_PRICE.amount + 1))

        player.receive(rolling(COMMAND_THREE))

        sent.last() shouldBe CommandRejected(COMMAND_THREE, "notEnoughFree")
    }

    "the lever makes the next roll legendary, and what it drew from goes to the roller's own panel" {
        val rig = Rig()
        val (player, sent) = rig.introduced()
        player.receive(founding())

        player.receive(nextRarity("legendary", COMMAND_TWO))
        player.receive(rolling(COMMAND_THREE))

        val drawn = sent.filterIsInstance<RollDrawn>().single()
        drawn.rarity shouldBe "legendary"
        drawn.forced shouldBe true
        drawn.opened shouldBe listOf("Hearth", "Coin", "Land")
        sent.filterIsInstance<YourChoice>().last().choice!!.options.map { it.rarity }.toSet() shouldBe setOf("legendary")
    }

    "with the instruments closed the lever is refused, and nothing of a draw is sent" {
        val rig = Rig(instrumentsOpen = false)
        val (player, sent) = rig.introduced()
        // Founding is a lever too, so this house is founded the player's way: by the choice it arrived to.
        val founding = rig.pending()!!
        player.receive(takingAction(founding.id.value.toString(), founding.options.first().id.value.toString()))

        player.receive(nextRarity("legendary", COMMAND_TWO))
        player.receive(rolling(COMMAND_THREE))

        sent shouldContain CommandRejected(COMMAND_TWO, "instrumentsClosed")
        sent shouldContain CommandAccepted(COMMAND_THREE)
        sent.filterIsInstance<RollDrawn>().shouldBeEmpty()
    }
})
