package villages.occurrent

import org.occurrent.application.converter.typemapper.CloudEventTypeMapper
import villages.domain.CharacterAged
import villages.domain.CharacterAppeared
import villages.domain.CharacterDied
import villages.domain.CharacterPortraitChanged
import villages.domain.CharacterStatChanged
import villages.domain.Event
import villages.domain.HouseFounded
import villages.domain.HouseGainedKeyFigure
import villages.domain.HouseLostKeyFigure
import villages.domain.HouseResourceGranted
import villages.domain.HouseResourcePledged
import villages.domain.HouseResourceReleased
import villages.domain.HouseResourceSpent
import villages.domain.PlayerGivenChoice
import villages.domain.PlayerTookAction
import kotlin.reflect.KClass

/**
 * The class of an event and its catalogued CloudEvent type, both ways, for every kind of stream. An
 * explicit table rather than a rule from the class name, because a v2 of an event is a new row here with
 * the same class or a new one, and that must be a decision somebody makes, not something reflection guesses.
 *
 * Every row is held to docs/EVENTS.md by the catalogue test, and every event class must appear here or the
 * same test fails.
 */
object EventTypes : CloudEventTypeMapper<Event> {
    val rows: Map<KClass<out Event>, String> = mapOf(
        CharacterAged::class to "villages.character.aged.v1",
        CharacterAppeared::class to "villages.character.appeared.v1",
        CharacterDied::class to "villages.character.died.v1",
        CharacterPortraitChanged::class to "villages.character.portraitChanged.v1",
        CharacterStatChanged::class to "villages.character.statChanged.v1",
        HouseFounded::class to "villages.house.founded.v1",
        HouseGainedKeyFigure::class to "villages.house.gainedKeyFigure.v1",
        HouseLostKeyFigure::class to "villages.house.lostKeyFigure.v1",
        HouseResourceGranted::class to "villages.house.resourceGranted.v1",
        HouseResourcePledged::class to "villages.house.resourcePledged.v1",
        HouseResourceReleased::class to "villages.house.resourceReleased.v1",
        HouseResourceSpent::class to "villages.house.resourceSpent.v1",
        PlayerGivenChoice::class to "villages.player.givenChoice.v1",
        PlayerTookAction::class to "villages.player.tookAction.v1",
    )

    private val byType: Map<String, KClass<out Event>> = rows.entries.associate { (klass, type) -> type to klass }

    override fun getCloudEventType(type: Class<out Event>): String =
        rows[type.kotlin] ?: throw IllegalArgumentException("${type.simpleName} has no catalogued type")

    @Suppress("UNCHECKED_CAST")
    override fun <E : Event> getDomainEventType(cloudEventType: String): Class<E> =
        (byType[cloudEventType] ?: throw IllegalArgumentException("$cloudEventType is not a catalogued event")).java as Class<E>
}
