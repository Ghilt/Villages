package villages.gateway

import villages.application.CharacterCommandExecutor
import villages.application.EventFeed
import villages.application.HouseCommandExecutor
import villages.application.Provenance
import villages.application.Start
import villages.application.StoredEvent
import villages.application.StructureCommandExecutor
import villages.application.WriteConflict
import villages.domain.CharacterCommand
import villages.domain.CharacterDecider
import villages.domain.CharacterEvent
import villages.domain.Event
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseEvent
import villages.domain.HouseFounded
import villages.domain.StructureCommand
import villages.domain.StructureDecider
import villages.domain.StructureEvent
import villages.domain.EventNames
import java.util.UUID

/** The catalogued type of an event, as the store would name it: by the rule the store names it by. */
internal fun typeOf(event: Event): String = EventNames.typeOf(event::class)

/**
 * Enough of the data for the gateway's tests: the founding's, which the events log's test reads. The stored form proper
 * is pinned by each event's own fixture, so no other event's is copied here.
 */
internal fun dataOf(event: HouseEvent): String = when (event) {
    is HouseFounded -> """{"name":"${event.name.value}","significance":${event.significance.value}}"""
    else -> "{}"
}

/**
 * A world small enough to hold in a test: one list of events, folded per stream, and a feed that delivers
 * synchronously. The gateway never knows the difference, which is the point of the ports.
 */
internal class TinyWorld : HouseCommandExecutor, CharacterCommandExecutor, StructureCommandExecutor, EventFeed {
    val events = mutableListOf<HouseEvent>()
    val characterEvents = mutableListOf<CharacterEvent>()
    val structureEvents = mutableListOf<StructureEvent>()
    private val structures = StructureDecider(RIG_CATALOGUE)

    override fun execute(command: StructureCommand, provenance: Provenance) {
        val stream = structureEvents.filter { it.structureId == command.structureId }
        val fresh = structures.decide(command, structures.fold(stream))
        structureEvents += fresh
        fresh.forEachIndexed { index, event ->
            publish(event, event.structureId.stream, (stream.size + index + 1).toLong(), idOf("s-${structureEvents.size}-$index"), provenance)
        }
    }

    /** One event stored and delivered, as the store would, for the streams that need no catalogued data of their own. */
    private fun publish(event: Event, stream: String, version: Long, id: String, provenance: Provenance) {
        val record = StoredEvent(
            id = id,
            type = "villages.structure.${event::class.simpleName!!.removePrefix("Structure").replaceFirstChar { it.lowercase() }}.v1",
            stream = stream,
            streamVersion = version,
            time = event.recordedAt,
            data = "{}",
            correlationId = provenance.correlationId.toString(),
            causationId = provenance.commandId.toString(),
            event = event,
        )
        this.stored += record
        subscribers.toList().forEach { it(record) }
    }

    override fun execute(command: CharacterCommand, provenance: Provenance) {
        val stream = characterEvents.filter { it.characterId == command.characterId }
        val fresh = CharacterDecider.decide(command, CharacterDecider.fold(stream))
        characterEvents += fresh
        fresh.forEachIndexed { index, event ->
            val record = StoredEvent(
                id = idOf("c-${characterEvents.size}-$index"),
                type = typeOf(event),
                stream = event.characterId.stream,
                streamVersion = (stream.size + index + 1).toLong(),
                time = event.recordedAt,
                data = "{}",
                correlationId = provenance.correlationId.toString(),
                causationId = provenance.commandId.toString(),
                event = event,
            )
            this.stored += record
            subscribers.toList().forEach { it(record) }
        }
    }

    /** When set, every command loses the race for its stream, the way a contested one behaves. */
    var contested = false
    /** What has been stored, so a subscriber that wants the beginning can be given it. */
    private val stored = mutableListOf<StoredEvent>()
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun execute(command: HouseCommand, provenance: Provenance) {
        if (contested) {
            throw WriteConflict(command.houseId.stream, events.size.toLong())
        }
        val stream = events.filter { it.houseId == command.houseId }
        val fresh = HouseDecider.decide(command, HouseDecider.fold(stream))
        events += fresh
        fresh.forEachIndexed { index, event ->
            val record = StoredEvent(
                id = idOf("e-${events.size}-$index"),
                type = typeOf(event),
                stream = event.houseId.stream,
                streamVersion = (stream.size + index + 1).toLong(),
                time = event.recordedAt,
                data = dataOf(event),
                correlationId = provenance.correlationId.toString(),
                causationId = provenance.commandId.toString(),
                event = event,
            )
            this.stored += record
            subscribers.toList().forEach { it(record) }
        }
    }

    /** An event's id, a UUID as the store's are, because a listener carries it on as what caused its command. */
    private fun idOf(name: String): String = UUID.nameUUIDFromBytes(name.toByteArray(Charsets.UTF_8)).toString()

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        if (from == Start.FROM_THE_BEGINNING) {
            stored.forEach(subscriber)
        }
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

}
