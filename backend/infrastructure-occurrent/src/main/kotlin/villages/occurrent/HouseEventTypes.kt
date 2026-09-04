package villages.occurrent

import org.occurrent.application.converter.typemapper.CloudEventTypeMapper
import villages.domain.HouseEvent
import villages.domain.HouseFounded
import kotlin.reflect.KClass

/**
 * The class of a house event and its catalogued CloudEvent type, both ways. An explicit table rather than a
 * rule from the class name, because a v2 of an event is a new row here with the same class or a new one,
 * and that must be a decision somebody makes, not something reflection guesses.
 *
 * Every row is held to docs/EVENTS.md by the catalogue test, and every HouseEvent subclass must appear here
 * or the same test fails.
 */
object HouseEventTypes : CloudEventTypeMapper<HouseEvent> {
    val rows: Map<KClass<out HouseEvent>, String> = mapOf(
        HouseFounded::class to "villages.house.founded.v1",
    )

    private val byType: Map<String, KClass<out HouseEvent>> = rows.entries.associate { (klass, type) -> type to klass }

    override fun getCloudEventType(type: Class<out HouseEvent>): String =
        rows[type.kotlin] ?: throw IllegalArgumentException("${type.simpleName} has no catalogued type")

    @Suppress("UNCHECKED_CAST")
    override fun <E : HouseEvent> getDomainEventType(cloudEventType: String): Class<E> =
        (byType[cloudEventType] ?: throw IllegalArgumentException("$cloudEventType is not a catalogued event")).java as Class<E>
}
