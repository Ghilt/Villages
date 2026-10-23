package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import villages.application.fate.GroundMap
import villages.domain.FOUNDING_WEALTH
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.Point
import villages.protocol.RollDrawn
import villages.protocol.YourChoice
import villages.protocol.YourDialogues
import villages.protocol.YourHouse
import villages.protocol.YourKeyFigures
import villages.domain.HouseId
import villages.domain.PlayerId
import java.util.UUID

/** Take action through the gateway: a roll paid for and answered with its hand, and Adam's lever on its luck. See 0083. */
class GatewayRollsSpec : StringSpec({
    fun rolling(commandId: String) =
        """{"type":"command","commandId":"$commandId","command":{"type":"roll","landing":{"lat":59.33,"lon":18.07}}}"""

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
        hand.omens.map { it.words } shouldBe listOf("Holdings in the northern reaches", "Weak house", "Summer")
        sent.filterIsInstance<YourHouse>().last().yours!!.resources.getValue("wealth").total shouldBe
            FOUNDING_WEALTH - RIG_BALANCE.roll.price
    }

    "a second Take action before the hand is answered is refused, and nothing is paid for it" {
        val rig = Rig()
        val (player, sent) = rig.introduced()
        player.receive(founding())
        player.receive(rolling(COMMAND_TWO))

        player.receive(rolling(COMMAND_THREE))

        sent.last() shouldBe CommandRejected(COMMAND_THREE, "choicePending")
        sent.filterIsInstance<YourHouse>().last().yours!!.resources.getValue("wealth").total shouldBe
            FOUNDING_WEALTH - RIG_BALANCE.roll.price
    }

    "a house without the price free cannot roll" {
        val rig = Rig()
        val (player, sent) = rig.introduced()
        player.receive(founding())
        player.receive(spending(amount = FOUNDING_WEALTH - RIG_BALANCE.roll.price + 1))

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

    "a roll reads what the page has open, and drops what the house may not see" {
        val rig = Rig()
        val (player, sent) = rig.introduced()
        player.receive(founding())
        rig.settle()
        player.receive(addingAKeyFigure(COMMAND_TWO))
        val figure = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single()
        player.receive(offering("letter", COMMAND_THREE))
        val letter = sent.filterIsInstance<YourDialogues>().last().dialogues.single().id
        // A neighbour inside the seat's 34 km, and a house four hundred kilometres off, which the fog hides.
        val near = "aa000000-0000-4000-8000-0000000000e1"
        val far = "aa000000-0000-4000-8000-0000000000e2"
        rig.introduced(near).first.receive(founding(name = "Varga", lat = 59.4, lon = 18.2))
        rig.introduced(far).first.receive(founding(name = "Holm", lat = HELSINKI_LAT, lon = HELSINKI_LON))
        fun houseOf(token: String) = HouseId.of(PlayerId(UUID.fromString(token))).value.toString()

        player.receive(
            """{"type":"command","commandId":"$COMMAND_FOUR","command":{"type":"roll",""" +
                """"inspectingHouses":["${houseOf(TOKEN)}","${houseOf(near)}","${houseOf(far)}"],""" +
                """"inspectingCharacters":["${figure.id}"],"dialogue":"$letter","figure":"${figure.id}"}}""",
        )

        val read = sent.filterIsInstance<YourChoice>().last().choice!!.omens.map { it.words }
        val name = "${figure.givenName} ${figure.familyName}"
        read shouldBe listOf(
            "Holdings in the northern reaches",
            "Weak house",
            "Inspecting your own house",
            "Inspecting House Varga",
            "Inspecting $name",
            "Unresolved: A letter from the coast",
            name,
            "Summer",
        )
    }

    "a debt a dialogue is waiting on is Missing wealth, and what rose since the last roll is said with how much" {
        val rig = Rig()
        val (player, sent) = rig.introduced()
        player.receive(founding())
        player.receive(addingAKeyFigure(commandNumber(1)))
        // The letter's first answer costs forty; the house is left with twenty-five free, enough to roll on.
        player.receive(offering("letter", commandNumber(2)))
        player.receive(spending(amount = FOUNDING_WEALTH - 25, commandId = commandNumber(3)))

        player.receive(rolling(commandNumber(4)))

        val first = sent.filterIsInstance<YourChoice>().last().choice!!
        first.omens.single { it.words == "Missing wealth" }.value shouldBe 15L
        player.receive(takingAction(first.id, first.options.first().id, commandNumber(5)))
        player.receive(granting(resource = "piety", amount = 30, commandId = commandNumber(6)))

        player.receive(rolling(commandNumber(7)))

        val second = sent.filterIsInstance<YourChoice>().last().choice!!
        second.omens.single { it.words == "Piety risen" }.value shouldBe 30L
    }

    "the map is read on the ground of the world the page said it draws, round where its die landed" {
        val rig = Rig()
        // A world of forest, cut as the masters are, a cell every sixth of a degree or so, so the landing circle holds
        // some; and the page saying at hello that it draws it.
        rig.grounds["woods"] = GroundMap(
            2048, 1024, mapOf(10 to "broadleaf-forest"), ByteArray(2048 * 1024 * 2) { at -> if (at % 2 == 0) 10 else 0 },
        )
        val (player, sent) = rig.introduced(master = "woods")
        player.receive(founding())
        rig.settle()

        player.receive(rolling(COMMAND_TWO))

        val hand = sent.filterIsInstance<YourChoice>().last().choice!!
        hand.omens.map { it.words } shouldContain "Forest"
        // Where it landed, and how wide a circle round it was read: the balance's, so the page can draw the die.
        hand.landing shouldBe Point(59.33, 18.07)
        hand.circleKm shouldBe 25.0
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
