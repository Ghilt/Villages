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
import villages.application.CharacterCommandExecutor
import villages.application.HouseCommandExecutor
import villages.application.Provenance
import villages.application.StructureCommandExecutor
import villages.application.WipeGate
import villages.application.WriteConflict
import villages.domain.CharacterCommand
import villages.domain.CharacterDecider
import villages.domain.CharacterEvent
import villages.domain.Decider
import villages.domain.Content
import villages.domain.Effect
import villages.domain.Event
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseEvent
import villages.domain.Objective
import villages.domain.QuestNode
import villages.domain.Requirement
import villages.domain.RevealImpact
import villages.domain.Shows
import villages.domain.Where
import villages.domain.StructureCatalogue
import villages.domain.StructureCommand
import villages.domain.StructureDecider
import villages.domain.StructureEvent
import villages.domain.Then
import java.net.URI
import java.time.ZoneOffset

/**
 * How an event is written and read, whichever stream it is on: the format decision record 0024 describes,
 * with the provenance decision record 0035 adds.
 *
 * The source is ours, the subject is the thing whose stream it is, the time is the instant the event was
 * recorded, and the data is the event's fields as Jackson writes a Kotlin class: value classes unwrapped, so
 * a world-time is a number, instants as ISO-8601 text, enums by their names, nulls written out so that a
 * type's shape is constant. Held to contracts/fixtures/events by a test.
 *
 * One converter for every kind of stream, because there is one store and one feed: an event read off the
 * feed is converted before anybody knows whose it is. See decision record 0055.
 */
object Events {
    val SOURCE: URI = URI.create("urn:villages")

    /** The story an event belongs to, and what directly caused it, as CloudEvent extensions. See 0035. */
    const val CORRELATION_ID = "correlationid"
    const val CAUSATION_ID = "causationid"

    val json: JsonMapper = JsonMapper.builder()
        .addModule(KotlinModule.Builder().build())
        // A sealed field says which case it holds, and the domain stays free of annotations.
        .addMixIn(Effect::class.java, EffectJson::class.java)
        .addMixIn(Then::class.java, ThenJson::class.java)
        .addMixIn(Requirement::class.java, RequirementJson::class.java)
        .addMixIn(RevealImpact::class.java, RevealImpactJson::class.java)
        .addMixIn(Shows::class.java, ShowsJson::class.java)
        .addMixIn(Content::class.java, ContentJson::class.java)
        .addMixIn(QuestNode::class.java, QuestNodeJson::class.java)
        .addMixIn(Objective::class.java, ObjectiveJson::class.java)
        .addMixIn(Where::class.java, WhereJson::class.java)
        .build()

    fun converter(): JacksonCloudEventConverter<Event> =
        JacksonCloudEventConverter.Builder<Event>(json, SOURCE)
            .typeMapper(EventTypes)
            .subjectMapper(::subjectOf)
            .timeMapper { event -> event.recordedAt.atOffset(ZoneOffset.UTC) }
            .build()

    /** The id of the thing whose stream an event is on, which is what a CloudEvent's subject is. */
    private fun subjectOf(event: Event): String = when (event) {
        is HouseEvent -> event.houseId.value.toString()
        is CharacterEvent -> event.characterId.value.toString()
        is StructureEvent -> event.structureId.value.toString()
    }
}

/** The same event, saying where it came from. The converter writes the data; this writes the envelope. */
internal fun CloudEvent.stamped(provenance: Provenance): CloudEvent =
    CloudEventBuilder.v1(this)
        .withExtension(Events.CORRELATION_ID, provenance.correlationId.toString())
        .withExtension(Events.CAUSATION_ID, provenance.commandId.toString())
        .build()

/**
 * How many times a command is retried when another writer reaches the stream first. Occurrent's decider
 * extension retried for us; doing the work by hand means doing that by hand too, or a busy stream would
 * refuse commands it could have accepted.
 */
private const val ATTEMPTS = 3

/**
 * The loop every command executor runs, whatever the stream holds: read the stream, fold it, decide, and
 * append what was decided under the stream's version.
 *
 * Written out rather than delegated to Occurrent's decider extension, which does exactly this and gives
 * no way to put anything on the envelope of what it writes. Provenance has to go on the envelope - it is
 * about the message and not about the game - so the loop is ours. See decision record 0035.
 *
 * Written once for every kind of stream, so a second kind of thing borrows the loop rather than growing a
 * copy of it that drifts. See decision record 0055.
 *
 * The whole loop is outside a wipe, [WipeGate]: a command read from the world before a wipe is never written
 * into the world after it. See decision record 0036.
 */
internal class StreamExecutor<C, S, E : Event>(
    private val store: EventStore,
    private val converter: CloudEventConverter<Event>,
    private val decider: Decider<C, S, E>,
    /** The kind of event this stream holds, which is every event the converter hands back from it. */
    private val holds: Class<E>,
    private val gate: WipeGate,
) {
    fun execute(stream: String, command: C, provenance: Provenance) = gate.outside { attempt(stream, command, provenance) }

    private fun attempt(stream: String, command: C, provenance: Provenance) {
        repeat(ATTEMPTS) {
            val held = store.read(stream)
            val version = held.version()
            val decided = decider.decide(
                command,
                decider.fold(held.eventList().map { holds.cast(converter.toDomainEvent(it)) }),
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

/** The house command executor port: the loop above, over a house's stream and a house's rules. */
class OccurrentHouseCommandExecutor(
    store: EventStore,
    converter: CloudEventConverter<Event>,
    gate: WipeGate,
) : HouseCommandExecutor {
    private val loop = StreamExecutor(store, converter, HouseDecider, HouseEvent::class.java, gate)

    override fun execute(command: HouseCommand, provenance: Provenance) =
        loop.execute(command.houseId.stream, command, provenance)
}

/** The character command executor port: the same loop, over a character's stream and a character's rules. */
class OccurrentCharacterCommandExecutor(
    store: EventStore,
    converter: CloudEventConverter<Event>,
    gate: WipeGate,
) : CharacterCommandExecutor {
    private val loop = StreamExecutor(store, converter, CharacterDecider, CharacterEvent::class.java, gate)

    override fun execute(command: CharacterCommand, provenance: Provenance) =
        loop.execute(command.characterId.stream, command, provenance)
}

/**
 * The structure command executor port: the same loop, over a structure's stream and a structure's rules, which read the
 * catalogue the server started with. See decision record 0093.
 */
class OccurrentStructureCommandExecutor(
    store: EventStore,
    converter: CloudEventConverter<Event>,
    catalogue: StructureCatalogue,
    gate: WipeGate,
) : StructureCommandExecutor {
    private val loop = StreamExecutor(store, converter, StructureDecider(catalogue), StructureEvent::class.java, gate)

    override fun execute(command: StructureCommand, provenance: Provenance) =
        loop.execute(command.structureId.stream, command, provenance)
}
