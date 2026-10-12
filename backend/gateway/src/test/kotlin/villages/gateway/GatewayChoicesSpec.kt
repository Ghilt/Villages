package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.domain.Effect
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.PlayerId
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.EventFrame
import villages.protocol.Point
import villages.protocol.YourChoice
import villages.protocol.YourHouse
import java.util.UUID

/** The gateway: founding a house, taking an option, and how a command and its answer and its story travel. The rig is GatewayRig.kt. */
class GatewayChoicesSpec : StringSpec({

    "a founding command is accepted, and the event reaches everyone watching" {
        val rig = Rig()
        val (founding, founder) = rig.introduced()
        val (watching, watcher) = rig.someoneElse()
        val (_, bystander) = rig.someoneElse()
        watching.receive("""{"type":"watchEvents","on":true}""")

        founding.receive(founding())

        founder.last() shouldBe CommandAccepted(COMMAND_ONE)
        rig.world.events.filterIsInstance<HouseFounded>() shouldHaveSize 1
        val event = watcher.last().shouldBeInstanceOf<EventFrame>()
        event.eventType shouldBe "villages.house.founded.v1"
        // The house is the player's own, worked out from the token rather than chosen by the browser.
        event.stream shouldBe HouseId.of(PlayerId(UUID.fromString(TOKEN))).stream
        // Second on the stream: arriving wrote the founding choice before this founded anything.
        event.streamVersion shouldBe 2
        event.time shouldBe noon.toEpochMilli()
        event.data.get("significance").asDouble() shouldBe 20.0
        bystander.shouldBeEmpty()
    }

    "the event says which command caused it, and which story it belongs to" {
        val rig = Rig()
        val (founder, _) = rig.introduced()
        val (watching, watcher) = rig.someoneElse()
        watching.receive("""{"type":"watchEvents","on":true}""")

        founder.receive(founding())

        val event = watcher.last().shouldBeInstanceOf<EventFrame>()
        // A founding starts a story of its own, so both ids are the command's. Decision record 0035.
        event.causationId shouldBe COMMAND_ONE
        event.correlationId shouldBe COMMAND_ONE
    }

    "a command whose id is not a UUID is refused before it is decided" {
        val rig = Rig()
        val (connection, sent) = rig.introduced()

        connection.receive(founding(commandId = "c-1"))

        sent.single() shouldBe CommandRejected("c-1", "malformed: a command id is a UUID")
        rig.world.events.filterIsInstance<HouseFounded>().shouldBeEmpty()
    }

    "a stream that will not stand still is a conflict, which is not a refusal" {
        val rig = Rig()
        rig.world.contested = true
        val (connection, sent) = rig.introduced()

        connection.receive(founding())

        sent.last() shouldBe CommandRejected(COMMAND_ONE, "conflict")
    }

    "the founder is told which house is theirs, without holding its cell" {
        val (connection, sent) = Rig().introduced()

        connection.receive(founding())

        connection.cells().shouldBeEmpty()
        sent.filterIsInstance<YourHouse>().last().yours?.house?.name shouldBe "Ravenscar"
    }

    "founding twice is rejected with the decider's reason as a code" {
        val (connection, sent) = Rig().introduced()

        connection.receive(founding())
        connection.receive(founding(commandId = COMMAND_TWO))

        sent.last() shouldBe CommandRejected(COMMAND_TWO, "alreadyFounded")
    }

    "taking an option founds the house where that option promised, and clears the parchment" {
        val rig = Rig()
        val (player, sent) = rig.introduced()
        val choice = rig.pending()!!
        val taking = choice.options[1]

        player.receive(takingAction(choice.id.value.toString(), taking.id.value.toString()))

        sent.filterIsInstance<CommandAccepted>().single().commandId shouldBe COMMAND_ONE
        val mine = sent.filterIsInstance<YourHouse>().last().yours!!.house
        val promised = taking.effect.shouldBeInstanceOf<Effect.FoundAt>()
        mine.name shouldBe promised.name.value
        mine.seat shouldBe Point(promised.seat.lat, promised.seat.lon)
        // Nothing left to decide: the parchment is gone, and the player is told so.
        sent.filterIsInstance<YourChoice>().last().choice shouldBe null
        rig.pending() shouldBe null
    }

    "and the action and the founding it caused are one story, told in that order" {
        val rig = Rig()
        val (player, _) = rig.introduced()
        val (watching, watcher) = rig.someoneElse()
        watching.receive("""{"type":"watchEvents","on":true}""")
        val choice = rig.pending()!!
        // A watcher is handed what it missed first. What this is about is what comes after it.
        watcher.clear()

        player.receive(takingAction(choice.id.value.toString(), choice.options[0].id.value.toString()))

        val events = watcher.filterIsInstance<EventFrame>()
        events.map { it.eventType } shouldBe
            listOf("villages.player.tookAction.v1", "villages.house.founded.v1")
        // One story, and it began with the choice: the action continues what arriving started.
        events.map { it.correlationId }.distinct() shouldHaveSize 1
        events.map { it.causationId }.distinct() shouldBe listOf(COMMAND_ONE)
        events.map { it.streamVersion } shouldBe listOf(2L, 3L)
    }

    "and that story is the choice's, even when the read model has not folded the choice yet" {
        val rig = Rig()
        val (player, _) = rig.introduced()
        val (watching, watcher) = rig.someoneElse()
        watching.receive("""{"type":"watchEvents","on":true}""")
        val choice = rig.pending()!!
        // The watcher is a player too, given a choice of its own: this one is on the first player's house.
        val given = watcher.filterIsInstance<EventFrame>()
            .single { it.eventType == "villages.player.givenChoice.v1" && it.stream == HouseId.of(PlayerId(UUID.fromString(TOKEN))).stream }
        watcher.clear()
        // A read model a hop behind, as it is when the broker carries the world (0094): it has not got the choice.
        rig.choices.reset()

        player.receive(takingAction(choice.id.value.toString(), choice.options[0].id.value.toString()))

        watcher.filterIsInstance<EventFrame>().map { it.correlationId }.distinct() shouldBe listOf(given.correlationId)
    }

    "taking an option that was not offered is refused, and says which rule refused it" {
        val rig = Rig()
        val (player, sent) = rig.introduced()
        val choice = rig.pending()!!

        player.receive(takingAction(choice.id.value.toString(), UUID.randomUUID().toString()))

        sent.last() shouldBe CommandRejected(COMMAND_ONE, "noSuchOption")
    }

    "answering a choice this house was never given is refused" {
        val rig = Rig()
        val (player, sent) = rig.introduced()

        player.receive(takingAction(UUID.randomUUID().toString(), UUID.randomUUID().toString()))

        sent.last() shouldBe CommandRejected(COMMAND_ONE, "noSuchChoice")
    }

    "an option id that is not an identifier at all is refused as malformed" {
        val rig = Rig()
        val (player, sent) = rig.introduced()
        val choice = rig.pending()!!

        player.receive(takingAction(choice.id.value.toString(), "the-second-one"))

        sent.last().shouldBeInstanceOf<CommandRejected>().reason shouldBe
            "malformed: an option id is a UUID, not the-second-one"
    }
})
