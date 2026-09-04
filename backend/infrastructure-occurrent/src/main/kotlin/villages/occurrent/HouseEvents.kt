package villages.occurrent

import org.occurrent.application.converter.jackson3.JacksonCloudEventConverter
import org.occurrent.application.service.blocking.ApplicationService
import org.occurrent.dsl.decider.Decider
import org.occurrent.dsl.decider.decider
import org.occurrent.dsl.decider.execute
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule
import villages.application.HouseCommandExecutor
import villages.domain.House
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseEvent
import java.net.URI
import java.time.ZoneOffset

/**
 * How a house event is written and read: the format decision record 0024 describes.
 *
 * The source is ours, the subject is the house, the time is the event's own instant rather than the clock
 * at the moment of storing, and the data is the event's fields as Jackson writes a Kotlin class: value
 * classes unwrapped, instants as ISO-8601 text, enums by their names, nulls written out so that a type's
 * shape is constant. Held to contracts/fixtures/events by a test.
 */
object HouseEvents {
    val SOURCE: URI = URI.create("urn:villages")

    val json: JsonMapper = JsonMapper.builder()
        .addModule(KotlinModule.Builder().build())
        .build()

    fun converter(): JacksonCloudEventConverter<HouseEvent> =
        JacksonCloudEventConverter.Builder<HouseEvent>(json, SOURCE)
            .typeMapper(HouseEventTypes)
            .subjectMapper { event -> event.houseId.value.toString() }
            .timeMapper { event -> event.at.atOffset(ZoneOffset.UTC) }
            .build()

    /** The domain's decider in the shape Occurrent drives. The rules stay in the domain. */
    val decider: Decider<HouseCommand, House, HouseEvent> = decider(
        initialState = HouseDecider.initial,
        decide = HouseDecider::decide,
        evolve = HouseDecider::evolve,
    )
}

/** The command executor port, on Occurrent's application service: load the stream, decide, append. */
class OccurrentHouseCommandExecutor(private val service: ApplicationService<HouseEvent>) : HouseCommandExecutor {
    override fun execute(command: HouseCommand) {
        service.execute(command.houseId.stream, command, HouseEvents.decider)
    }
}
