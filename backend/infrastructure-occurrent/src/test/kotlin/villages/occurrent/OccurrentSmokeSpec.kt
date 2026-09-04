package villages.occurrent

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import org.occurrent.application.converter.jackson3.JacksonCloudEventConverter
import org.occurrent.application.converter.typemapper.ReflectionCloudEventTypeMapper
import org.occurrent.application.service.blocking.generic.GenericApplicationService
import org.occurrent.dsl.decider.decider
import org.occurrent.dsl.decider.execute
import org.occurrent.eventstore.inmemory.InMemoryEventStore
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule
import java.net.URI
import java.util.UUID

/**
 * The riskiest assumption in the startup plan, compiled and run: that Occurrent 0.33 works under Spring
 * Boot 4's Jackson 3, and that a Kotlin decider drives its application service. Nothing here is the game.
 * It is a tally, chosen to be too small to hide anything, and it is deleted the day the house decider
 * takes its place in increment 1.5.
 */
sealed interface TallyEvent {
    val tally: String
}

data class Started(override val tally: String) : TallyEvent

data class Counted(override val tally: String, val by: Int) : TallyEvent

sealed interface TallyCommand

data class Start(val tally: String) : TallyCommand

data class Count(val tally: String, val by: Int) : TallyCommand

data class Tally(val started: Boolean = false, val total: Int = 0)

/** Shaped exactly as the house decider will be: decide returns events, evolve folds one in. */
val tallyDecider = decider<TallyCommand, Tally, TallyEvent>(
    initialState = Tally(),
    decide = { command, state ->
        when (command) {
            is Start -> if (state.started) emptyList() else listOf(Started(command.tally))
            is Count -> listOf(Counted(command.tally, command.by))
        }
    },
    evolve = { state, event ->
        when (event) {
            is Started -> state.copy(started = true)
            is Counted -> state.copy(total = state.total + event.by)
        }
    },
)

class OccurrentSmokeSpec : StringSpec({

    "a command becomes a stored CloudEvent and comes back as the same Kotlin event" {
        val store = InMemoryEventStore()
        val json = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()
        val converter = JacksonCloudEventConverter.Builder<TallyEvent>(json, URI.create("urn:villages"))
            .typeMapper(ReflectionCloudEventTypeMapper.simple(TallyEvent::class.java))
            .build()
        val service = GenericApplicationService(store, converter)
        val stream = UUID.randomUUID()

        service.execute(stream, Start("harvest"), tallyDecider)
        service.execute(stream, Count("harvest", 3), tallyDecider)
        service.execute(stream, Count("harvest", 4), tallyDecider)

        val stored = store.read(stream.toString()).events().toList()
        stored shouldHaveSize 3
        stored[0].source shouldBe URI.create("urn:villages")
        stored[0].type shouldBe "Started"
        stored[2].type shouldBe "Counted"

        val events = stored.map(converter::toDomainEvent)
        events shouldBe listOf(Started("harvest"), Counted("harvest", 3), Counted("harvest", 4))
        tallyDecider.evolve(tallyDecider.initialState(), events) shouldBe Tally(started = true, total = 7)
    }

    "a decision that yields no event writes nothing, which is how idempotence will work" {
        val store = InMemoryEventStore()
        val json = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()
        val converter = JacksonCloudEventConverter.Builder<TallyEvent>(json, URI.create("urn:villages")).build()
        val service = GenericApplicationService(store, converter)
        val stream = UUID.randomUUID()

        service.execute(stream, Start("harvest"), tallyDecider)
        service.execute(stream, Start("harvest"), tallyDecider)

        store.read(stream.toString()).events().toList() shouldHaveSize 1
    }
})
