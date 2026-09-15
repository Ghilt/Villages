package villages.occurrent

import io.cloudevents.CloudEvent
import io.cloudevents.core.builder.CloudEventBuilder
import org.occurrent.application.converter.CloudEventConverter
import org.occurrent.application.converter.jackson3.JacksonCloudEventConverter
import org.occurrent.eventstore.api.WriteCondition
import org.occurrent.eventstore.api.WriteConditionNotFulfilledException
import org.occurrent.eventstore.api.blocking.EventStore
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule
import villages.application.HouseCommandExecutor
import villages.application.Provenance
import villages.application.WriteConflict
import villages.domain.Effect
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseEvent
import java.net.URI
import java.time.ZoneOffset

/**
 * How a house event is written and read: the format decision record 0024 describes, with the provenance
 * decision record 0035 adds.
 *
 * The source is ours, the subject is the house, the time is the instant the event was recorded, and the
 * data is the event's fields as Jackson writes a Kotlin class: value classes unwrapped, so a world-time is
 * a number, instants as ISO-8601 text, enums by their names, nulls written out so that a type's shape is
 * constant. Held to contracts/fixtures/events by a test.
 */
object HouseEvents {
    val SOURCE: URI = URI.create("urn:villages")

    /** The story an event belongs to, and what directly caused it, as CloudEvent extensions. See 0035. */
    const val CORRELATION_ID = "correlationid"
    const val CAUSATION_ID = "causationid"

    val json: JsonMapper = JsonMapper.builder()
        .addModule(KotlinModule.Builder().build())
        // A sealed field says which case it holds, and the domain stays free of annotations.
        .addMixIn(Effect::class.java, EffectJson::class.java)
        .build()

    fun converter(): JacksonCloudEventConverter<HouseEvent> =
        JacksonCloudEventConverter.Builder<HouseEvent>(json, SOURCE)
            .typeMapper(HouseEventTypes)
            .subjectMapper { event -> event.houseId.value.toString() }
            .timeMapper { event -> event.recordedAt.atOffset(ZoneOffset.UTC) }
            .build()
}

/** The same event, saying where it came from. The converter writes the data; this writes the envelope. */
internal fun CloudEvent.stamped(provenance: Provenance): CloudEvent =
    CloudEventBuilder.v1(this)
        .withExtension(HouseEvents.CORRELATION_ID, provenance.correlationId.toString())
        .withExtension(HouseEvents.CAUSATION_ID, provenance.commandId.toString())
        .build()

/**
 * How many times a command is retried when another writer reaches the stream first. Occurrent's decider
 * extension retried for us; doing the work by hand means doing that by hand too, or a busy stream would
 * refuse commands it could have accepted.
 */
private const val ATTEMPTS = 3

/**
 * The command executor port: read the stream, fold it, decide, and append what was decided under the
 * stream's version.
 *
 * Written out rather than delegated to Occurrent's decider extension, which does exactly this and gives
 * no way to put anything on the envelope of what it writes. Provenance has to go on the envelope - it is
 * about the message and not about the game - so the loop is ours. See decision record 0035.
 */
class OccurrentHouseCommandExecutor(
    private val store: EventStore,
    private val converter: CloudEventConverter<HouseEvent>,
) : HouseCommandExecutor {
    override fun execute(command: HouseCommand, provenance: Provenance) {
        val stream = command.houseId.stream

        repeat(ATTEMPTS) {
            val held = store.read(stream)
            val version = held.version()
            val decided = HouseDecider.decide(
                command,
                HouseDecider.fold(held.eventList().map(converter::toDomainEvent)),
            )

            // A decision that yields nothing writes nothing, which is how a repeated command stays harmless.
            if (decided.isEmpty()) {
                return
            }

            try {
                store.write(
                    stream,
                    WriteCondition.streamVersionEq(version),
                    decided.map { event -> converter.toCloudEvent(event).stamped(provenance) },
                )
                return
            } catch (@Suppress("SwallowedException") taken: WriteConditionNotFulfilledException) {
                // Somebody wrote between the read and the write. Decide again against what is there now:
                // the decider may refuse this time, which is a refusal and not a conflict.
                if (it == ATTEMPTS - 1) {
                    throw WriteConflict(stream, version)
                }
            }
        }
    }
}
