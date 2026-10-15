package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.domain.HouseFounded
import villages.domain.PlayerId
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.ErrorFrame
import villages.protocol.FoundAtView
import villages.protocol.Pong
import villages.protocol.ServerFrame
import villages.protocol.TakenOver
import villages.protocol.Welcome
import villages.protocol.WorldWiped
import villages.protocol.WorldNow
import villages.protocol.YourChoice
import villages.protocol.YourHouse
import java.util.UUID

/** The gateway: arriving, being taken over, and the frames that answer before anything is looked at. The rig is GatewayRig.kt. */
class GatewaySessionsSpec : StringSpec({

    "hello's frames come in one order: the welcome, then the house's own, then what it is asked" {
        val rig = Rig()
        val (founder, _) = rig.introduced()
        founder.receive(founding())
        founder.receive(addingAKeyFigure(commandNumber(7)))

        // Arriving again, as a second window of the same player: everything the house has is said to it.
        val sent = mutableListOf<ServerFrame>()
        rig.gateway.connect { sent += it }.receive(hello)

        sent.map { it::class.simpleName }.take(8) shouldBe listOf(
            "Welcome", "YourHouse", "YourKeyFigures", "YourHoldings", "YourSight", "YourDialogues", "YourQuests", "YourChoice",
        )
    }

    "hello is answered with welcome, the house this player has, and the choice they have to make" {
        val sent = mutableListOf<ServerFrame>()
        Rig().gateway.connect { sent += it }.receive(hello)

        sent.take(2) shouldBe listOf(
            Welcome(
                serverTime = noon.toEpochMilli(),
                playerId = TOKEN,
                world = WorldNow(today = today.day, earliest = today.day),
                keptIn = "in memory, and gone when the server stops",
            ),
            YourHouse(null),
        )
        // Arriving with no house is what the founding choice answers, and it is said exactly once.
        sent.filterIsInstance<YourChoice>().single().choice?.prompt shouldBe
            "Where shall the house raise its seat?"
    }

    "and that choice offers three seats, in three different parts of the world" {
        val sent = mutableListOf<ServerFrame>()
        Rig().gateway.connect { sent += it }.receive(hello)

        val choice = sent.filterIsInstance<YourChoice>().single().choice!!
        choice.options shouldHaveSize 3
        // Each option is a destiny: a place, a name and a banner of its own.
        choice.options.map { it.effect.shouldBeInstanceOf<FoundAtView>().name }.distinct() shouldHaveSize 3
        choice.options.map { it.label.substringAfter(", in ") }.distinct() shouldHaveSize 3
    }

    "a player who already has a house is given nothing to decide" {
        val rig = Rig()
        val (founder, _) = rig.introduced()
        founder.receive(founding())
        founder.disconnected()
        val sent = mutableListOf<ServerFrame>()

        rig.gateway.connect { sent += it }.receive(hello)

        sent.filterIsInstance<YourChoice>().single().choice shouldBe null
    }

    "a player who already has a house is told which on hello, before looking at anything" {
        val rig = Rig()
        // The same player, coming back: a fresh window, and the house is still theirs.
        val (founder, _) = rig.introduced()
        founder.receive(founding())
        founder.disconnected()
        val sent = mutableListOf<ServerFrame>()

        rig.gateway.connect { sent += it }.receive(hello)

        val mine = sent.filterIsInstance<YourHouse>().last().yours?.house
        mine?.name shouldBe "Ravenscar"
        mine?.cell shouldBe STOCKHOLM_Z10
    }

    "a client of another protocol version, or with no token, is told so and not welcomed" {
        val sent = mutableListOf<ServerFrame>()
        val connection = Rig().gateway.connect { sent += it }

        connection.receive("""{"type":"hello","playerToken":"$TOKEN","protocolVersion":${PROTOCOL_VERSION + 1}}""")
        connection.receive("""{"type":"hello","playerToken":"nope","protocolVersion":$PROTOCOL_VERSION}""")
        connection.receive("this is not json")

        sent.map { it.shouldBeInstanceOf<ErrorFrame>().code } shouldBe listOf("protocolVersion", "playerToken", "unreadable")
    }

    "wiping the world empties it and finishes every session, whoever asked" {
        val rig = Rig()
        val (player, mine) = rig.introduced()
        val (other, theirs) = rig.someoneElse()
        other.receive(founding())
        mine.clear()
        theirs.clear()

        player.receive("""{"type":"wipeWorld"}""")

        // Everybody is told, because a wipe is everybody's.
        mine.last().shouldBeInstanceOf<WorldWiped>().message shouldBe "the world was emptied; 3 events went"
        theirs.last().shouldBeInstanceOf<WorldWiped>()
        rig.world.events.shouldBeEmpty()
        rig.houses.size shouldBe 0
        rig.choices.size shouldBe 0
    }

    "and a session finished by a wipe can do nothing more" {
        val rig = Rig()
        val (player, sent) = rig.introduced()
        player.receive("""{"type":"wipeWorld"}""")
        sent.clear()

        player.receive(founding())
        player.receive(subscribe(STOCKHOLM_Z8))

        sent.shouldBeEmpty()
        player.cells().shouldBeEmpty()
    }

    "a command before hello is rejected, because nobody is speaking" {
        val sent = mutableListOf<ServerFrame>()
        Rig().gateway.connect { sent += it }.receive(founding())

        sent.single() shouldBe CommandRejected(COMMAND_ONE, "notIntroduced")
    }

    "ping is answered with pong carrying the client's stamp and the server's time" {
        val (connection, sent) = Rig().introduced()

        connection.receive("""{"type":"ping","t0":1234}""")

        sent.single() shouldBe Pong(1234, noon.toEpochMilli())
    }

    "a second window takes the player over, and the first is told and stood down" {
        val rig = Rig()
        val (first, one) = rig.introduced()
        first.receive(subscribe(STOCKHOLM_Z8))
        one.clear()

        val (second, two) = rig.introduced()

        one.single().shouldBeInstanceOf<TakenOver>()
        first.cells().shouldBeEmpty()
        two.shouldBeEmpty()
        second.receive(founding())
        two.last() shouldBe CommandAccepted(COMMAND_ONE)
    }

    "a stood-down session hears nothing more and can do nothing more" {
        val rig = Rig()
        val (first, one) = rig.introduced()
        first.receive(subscribe(STOCKHOLM_Z8))
        rig.introduced()
        one.clear()

        first.receive(founding())
        first.receive(subscribe(STOCKHOLM_Z4))
        first.receive("""{"type":"ping","t0":1}""")
        rig.aHouseIsFounded()
        rig.later.tick()

        one.shouldBeEmpty()
        rig.world.events.filterIsInstance<HouseFounded>().shouldHaveSize(1)
    }

    "the loser's close does not evict the window that took over, however late it arrives" {
        val rig = Rig()
        val (first, _) = rig.introduced()
        val (second, two) = rig.introduced()
        two.clear()

        // The old socket goes away after the takeover, which is the ordinary case and the dangerous one.
        first.disconnected()
        rig.aHouseIsFounded()

        // Still the session: its own house would still find it, and it is still able to act.
        second.receive(founding(name = "Mine"))
        two.last() shouldBe CommandAccepted(COMMAND_ONE)
        two.filterIsInstance<YourHouse>().last().yours?.house?.name shouldBe "Mine"
    }

    "saying hello twice on one connection is refused rather than quietly changing who you are" {
        val (connection, sent) = Rig().introduced()

        connection.receive(hello)

        sent.single().shouldBeInstanceOf<ErrorFrame>().code shouldBe "alreadyIntroduced"
    }

    "a player founds one house, and founding again is refused however many windows have tried" {
        val rig = Rig()
        val (first, _) = rig.introduced()
        first.receive(founding())

        val (second, two) = rig.introduced()
        second.receive(founding(commandId = COMMAND_TWO))

        two.last() shouldBe CommandRejected(COMMAND_TWO, "alreadyFounded")
        rig.world.events.filterIsInstance<HouseFounded>() shouldHaveSize 1
        rig.houses.ofPlayer(PlayerId(UUID.fromString(TOKEN)))?.name?.value shouldBe "Ravenscar"
    }
})
