package villages.occurrent

import io.cloudevents.CloudEvent
import io.cloudevents.core.builder.CloudEventBuilder
import io.cloudevents.core.data.BytesCloudEventData
import org.occurrent.application.converter.CloudEventConverter
import tools.jackson.databind.node.ObjectNode
import villages.domain.Event

/**
 * One step from an event type no longer written to the one that replaced it: the stored type it reads, the type it
 * hands on, and what it does to the stored data on the way. An event's shape changes by a new type, `….v2`, catalogued
 * in [EventTypes] in place of the old, and a step from the old to it here; the store is never rewritten. See decision
 * record 0100.
 */
class Upcaster(val from: String, val to: String, val change: (ObjectNode) -> ObjectNode)

/**
 * Every step from a retired type, chained: a stored event is carried from the type it was written as, one step at a
 * time, to the type the code reads today. An event whose type no step starts from is handed on as it is, which today is
 * every event, since every type is still its first version.
 *
 * What holds it, in `UpcastersSpec`: a step starts only from a type no longer catalogued, every chain ends at one that
 * is, no type is reached twice, and every retired type keeps the fixture it was stored as, which must still read back.
 */
class Upcasters(val steps: List<Upcaster>) {
    private val byFrom: Map<String, Upcaster> = steps.associateBy { it.from }

    init {
        require(byFrom.size == steps.size) { "two steps start from one type: ${steps.groupBy { it.from }.filterValues { it.size > 1 }.keys}" }
    }

    /** The event as the code reads it today: carried through every step from the type it was stored as. */
    fun upcast(stored: CloudEvent): CloudEvent {
        var event = stored
        val passed = mutableSetOf<String>()
        while (true) {
            val step = byFrom[event.type] ?: return event
            check(passed.add(event.type)) { "the steps from ${stored.type} go round in a ring through ${event.type}" }
            val data = Events.json.readTree(event.data!!.toBytes()) as ObjectNode
            event = CloudEventBuilder.v1(event)
                .withType(step.to)
                .withData(event.dataContentType, BytesCloudEventData.wrap(Events.json.writeValueAsBytes(step.change(data))))
                .build()
        }
    }

    companion object {
        /** The steps the code knows, from every type ever retired. None yet: every event is its first version. */
        val ALL = Upcasters(emptyList())
    }
}

/**
 * The converter every reader of the store uses, with [upcasters] between a stored event and the domain event: writing is
 * untouched, since the code only ever writes today's types, and reading carries an event written as an older one up to
 * today's first.
 */
class UpcastingConverter(
    private val inner: CloudEventConverter<Event>,
    private val upcasters: Upcasters,
) : CloudEventConverter<Event> {
    override fun toCloudEvent(event: Event): CloudEvent = inner.toCloudEvent(event)

    override fun toDomainEvent(stored: CloudEvent): Event = inner.toDomainEvent(upcasters.upcast(stored))

    override fun getCloudEventType(type: Class<out Event>): String = inner.getCloudEventType(type)
}
