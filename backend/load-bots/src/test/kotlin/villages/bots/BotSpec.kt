package villages.bots

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.protocol.Cell
import villages.protocol.ClientFrame
import villages.protocol.Command
import villages.protocol.Hello
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.ProtocolJson
import villages.protocol.RollPayload
import villages.protocol.SubscribeCells
import villages.protocol.TakeActionPayload
import villages.protocol.UnsubscribeCells
import villages.protocol.YourChoice
import villages.protocol.YourHouse
import java.io.File
import kotlin.random.Random

/** The bot against the server's own frames, the shared fixtures, with a list for its wire and a clock it is handed. */
class BotSpec : StringSpec({

    fun server(name: String) = File("../../contracts/fixtures/frames/server/$name.json").readText()

    class Rig {
        val sent = mutableListOf<ClientFrame>()
        var clock = 1_000L
        val trips = RoundTrips()
        val bot = Bot(
            wire = object : Wire {
                override fun send(text: String) {
                    sent += ProtocolJson.decodeClient(text)
                }

                override fun close() = Unit
            },
            trips = trips,
            pace = Pace(panEvery = 20_000, rollEvery = 60_000, jitter = 0.0),
            random = Random(7),
            now = { clock },
        )

        fun commands() = sent.filterIsInstance<Command>().map { it.command }
    }

    fun seated(): Rig = Rig().apply {
        bot.opened()
        bot.heard(server("welcome"))
        bot.heard(server("yourChoice"))
        bot.heard(server("yourHouse"))
    }

    "says hello as a player of its own, on the protocol's version, and times the welcome" {
        val rig = Rig()
        rig.bot.opened()
        rig.sent.single() shouldBe Hello(PROTOCOL_VERSION, playAs = rig.bot.token)

        rig.clock += 40
        rig.bot.heard(server("welcome"))
        rig.bot.stage shouldBe Bot.Stage.SEATING
        rig.trips.drain().took.getValue(Trip.WELCOME) shouldBe listOf(40L)
    }

    "answers a choice once, with one of its options, however often it is shown" {
        val rig = Rig()
        rig.bot.opened()
        rig.bot.heard(server("yourChoice"))
        rig.bot.heard(server("yourChoice"))

        val offered = (ProtocolJson.decodeServer(server("yourChoice")) as YourChoice).choice!!
        val taken = rig.commands().single().shouldBeInstanceOf<TakeActionPayload>()
        taken.choiceId shouldBe offered.id
        offered.options.map { it.id } shouldContain taken.optionId
    }

    "follows the nine cells round its seat once it has a house, and times each one's snapshot" {
        val rig = seated()
        val seat = (ProtocolJson.decodeServer(server("yourHouse")) as YourHouse).yours!!.house.seat

        rig.bot.stage shouldBe Bot.Stage.PLAYING
        val followed = rig.sent.filterIsInstance<SubscribeCells>().single().cells
        followed shouldHaveSize 9
        followed shouldContain Cell.of(seat.lat, seat.lon, Neighbourhood.ZOOM).quadkey

        // The fixture's snapshot is of the fixture house's own cell.
        rig.bot.heard(server("snapshot"))
        rig.trips.drain().took.getValue(Trip.SNAPSHOT) shouldHaveSize 1
    }

    "does nothing on its clock before it has a house" {
        val rig = Rig()
        rig.bot.opened()
        rig.clock += 120_000
        rig.bot.tick()
        rig.sent shouldHaveSize 1
    }

    "pans when a pan is due and rolls when a roll is, and times the roll's answer" {
        val rig = seated()
        val before = rig.sent.size

        rig.clock += 20_000
        rig.bot.tick()
        val panned = rig.sent.drop(before)
        panned.filterIsInstance<SubscribeCells>().shouldHaveSize(1)
        panned.filterIsInstance<UnsubscribeCells>().shouldHaveSize(1)
        rig.commands().filterIsInstance<RollPayload>().shouldBeEmpty()

        rig.clock += 40_000
        rig.bot.tick()
        val roll = rig.sent.filterIsInstance<Command>().last()
        roll.command.shouldBeInstanceOf<RollPayload>()

        rig.clock += 25
        rig.bot.heard("""{"type":"commandAccepted","commandId":"${roll.commandId}"}""")
        rig.trips.drain().took.getValue(Trip.ACCEPTED) shouldContain 25L
    }

    "is gone when another window takes its player over, and says nothing more" {
        val rig = seated()
        val before = rig.sent.size

        rig.bot.heard(server("takenOver"))
        rig.clock += 120_000
        rig.bot.tick()

        rig.bot.stage shouldBe Bot.Stage.GONE
        rig.sent shouldHaveSize before
        rig.trips.drain().failed shouldBe 1
    }

    "counts a refusal, an error and a frame it cannot read as failures" {
        val rig = seated()
        rig.bot.heard(server("commandRejected"))
        rig.bot.heard(server("error"))
        rig.bot.heard("""{"type":"nothingTheServerSays"}""")
        rig.trips.drain().failed shouldBe 3
    }
})
