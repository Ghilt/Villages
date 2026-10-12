package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.domain.Effect
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseError
import villages.domain.HouseEvent
import villages.domain.PlayerGivenChoice
import villages.domain.HouseId
import villages.domain.PlayerTookAction
import villages.domain.PlayerId
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID

/** One stream per house, folded in a list: enough to drive a use case without a store. */
private class RememberingWorld : HouseCommandExecutor {
    val events = mutableListOf<HouseEvent>()
    val provenances = mutableListOf<Provenance>()

    override fun execute(command: HouseCommand, provenance: Provenance) {
        val stream = events.filter { it.houseId == command.houseId }
        events += HouseDecider.decide(command, HouseDecider.fold(stream))
        provenances += provenance
    }
}

class ArrivalSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val day = WorldTime(454901)
    val adam = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val given = UUID.fromString("a1000000-0000-4000-8000-00000000000a")

    fun rig(): Pair<RememberingWorld, Arrival> {
        val world = RememberingWorld()
        return world to Arrival(world, clock = { noon }, world = { day }, ids = { given })
    }

    "a player with no house and nothing to decide is asked where to found one" {
        val (world, arrival) = rig()

        val choice = arrival.arrive(adam)?.choice

        choice shouldBe FoundingChoices.forPlayer(adam)
        val event = world.events.single().shouldBeInstanceOf<PlayerGivenChoice>()
        event.houseId shouldBe HouseId.of(adam)
        event.player shouldBe adam
        event.worldTime shouldBe day
        event.recordedAt shouldBe noon
    }

    "and arriving starts a story, so the choice is its own correlation" {
        val (world, arrival) = rig()

        val story = arrival.arrive(adam)!!.story

        world.provenances.single() shouldBe Provenance(commandId = given, correlationId = given)
        // Handed back, so the action answering the choice continues it without asking a read model.
        story shouldBe given
    }

    "arriving again gives nothing, because the first question has not been answered" {
        val (world, arrival) = rig()
        arrival.arrive(adam)

        arrival.arrive(adam) shouldBe null

        world.events shouldHaveSize 1
    }

    "a player who has already founded is asked nothing" {
        val (world, arrival) = rig()
        val choice = arrival.arrive(adam)!!.choice
        world.execute(
            villages.domain.TakeAction(
                houseId = HouseId.of(adam),
                player = adam,
                choiceId = choice.id,
                optionId = choice.options.first().id,
                worldTime = day,
                recordedAt = noon,
            ),
            Provenance.startedBy(given),
        )

        arrival.arrive(adam) shouldBe null

        // The choice, the action, and what the action did. Nothing more was written.
        world.events.map { it::class.simpleName } shouldBe
            listOf("PlayerGivenChoice", "PlayerTookAction", "HouseFounded")
    }

    "taking an option founds the house where that option promised" {
        val (world, arrival) = rig()
        val choice = arrival.arrive(adam)!!.choice
        val taking = choice.options[2]
        val service = TakeActionService(world, clock = { noon }, world = { day })

        service.take(adam, choice.id, taking.id, Provenance.startedBy(given))

        world.events[1].shouldBeInstanceOf<PlayerTookAction>().optionId shouldBe taking.id
        val founded = world.events[2].shouldBeInstanceOf<villages.domain.HouseFounded>()
        founded.seat shouldBe taking.effect.shouldBeInstanceOf<Effect.FoundAt>().seat
    }

    "and the decider's refusal comes back through the service untouched" {
        val (world, arrival) = rig()
        arrival.arrive(adam)
        val service = TakeActionService(world, clock = { noon }, world = { day })

        shouldThrow<HouseError.NoSuchOption> {
            service.take(adam, FoundingChoices.forPlayer(adam).id, villages.domain.OptionId(given), Provenance.startedBy(given))
        }
    }
})
