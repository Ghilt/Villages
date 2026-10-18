package villages.occurrent

import org.occurrent.application.converter.typemapper.CloudEventTypeMapper
import villages.domain.Event
import villages.domain.EventNames
import kotlin.reflect.KClass

/**
 * The class of an event and its catalogued CloudEvent type, both ways, for every kind of stream: every event the code
 * has, named by the rule `EventNames` keeps, at the version [VERSIONS] says.
 *
 * The version is a decision, not something reflection guesses: an event is written at its first until a change to its
 * shape makes it a new type, and then its class is put in [VERSIONS] at the next, beside the upcaster from the old one
 * (0100). Every row is held to docs/EVENTS.md by the catalogue test, and the recorded stores hold every type that was
 * ever written to reading back. A new event needs nothing here. See `docs/plans/mechanic-modules.md`, step 2.
 */
object EventTypes : CloudEventTypeMapper<Event> {
    /** Every event written at a version other than its first, and that version. */
    private val VERSIONS: Map<KClass<out Event>, Int> = emptyMap()

    val rows: Map<KClass<out Event>, String> =
        leaves(Event::class).associateWith { EventNames.typeOf(it, VERSIONS[it] ?: 1) }

    private val byType: Map<String, KClass<out Event>> = rows.entries.associate { (klass, type) -> type to klass }

    override fun getCloudEventType(type: Class<out Event>): String =
        rows[type.kotlin] ?: throw IllegalArgumentException("${type.simpleName} has no catalogued type")

    @Suppress("UNCHECKED_CAST")
    override fun <E : Event> getDomainEventType(cloudEventType: String): Class<E> =
        (byType[cloudEventType] ?: throw IllegalArgumentException("$cloudEventType is not a catalogued event")).java as Class<E>
}

/** The events under a sealed part of the hierarchy, each once: an event is reached through its stream and its half. */
private fun leaves(of: KClass<out Event>): List<KClass<out Event>> =
    of.sealedSubclasses.flatMap { if (it.isSealed) leaves(it) else listOf(it) }.distinct()
