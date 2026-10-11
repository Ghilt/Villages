package villages.occurrent

import org.occurrent.application.converter.typemapper.CloudEventTypeMapper
import villages.domain.CharacterAged
import villages.domain.CharacterAppeared
import villages.domain.CharacterDied
import villages.domain.CharacterLeftTheMap
import villages.domain.CharacterMoved
import villages.domain.CharacterPortraitChanged
import villages.domain.CharacterStatChanged
import villages.domain.Event
import villages.domain.HouseFounded
import villages.domain.HouseGainedKeyFigure
import villages.domain.HouseGainedVision
import villages.domain.HouseLostKeyFigure
import villages.domain.HouseLostVision
import villages.domain.HouseLostSeat
import villages.domain.HouseNamedSeat
import villages.domain.HouseResourceGranted
import villages.domain.HouseResourcePledged
import villages.domain.HouseResourceReleased
import villages.domain.HouseResourceSpent
import villages.domain.PlayerCompletedDialogue
import villages.domain.PlayerCompletedDialogueStep
import villages.domain.PlayerGivenChoice
import villages.domain.PlayerRolled
import villages.domain.PlayerLostDialogue
import villages.domain.PlayerOfferedDialogue
import villages.domain.PlayerTookAction
import villages.domain.StructureChangedHands
import villages.domain.StructureLevelChanged
import villages.domain.StructureRebuilt
import villages.domain.StructureRuined
import villages.domain.StructureRaised
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
        CharacterLeftTheMap::class to "villages.character.leftTheMap.v1",
        CharacterMoved::class to "villages.character.moved.v1",
        CharacterPortraitChanged::class to "villages.character.portraitChanged.v1",
        CharacterStatChanged::class to "villages.character.statChanged.v1",
        HouseFounded::class to "villages.house.founded.v1",
        HouseGainedKeyFigure::class to "villages.house.gainedKeyFigure.v1",
        HouseGainedVision::class to "villages.house.gainedVision.v1",
        HouseLostKeyFigure::class to "villages.house.lostKeyFigure.v1",
        HouseLostVision::class to "villages.house.lostVision.v1",
        HouseResourceGranted::class to "villages.house.resourceGranted.v1",
        HouseResourcePledged::class to "villages.house.resourcePledged.v1",
        HouseResourceReleased::class to "villages.house.resourceReleased.v1",
        HouseResourceSpent::class to "villages.house.resourceSpent.v1",
        PlayerCompletedDialogue::class to "villages.player.completedDialogue.v1",
        PlayerCompletedDialogueStep::class to "villages.player.completedDialogueStep.v1",
        PlayerGivenChoice::class to "villages.player.givenChoice.v1",
        PlayerLostDialogue::class to "villages.player.lostDialogue.v1",
        PlayerOfferedDialogue::class to "villages.player.offeredDialogue.v1",
        PlayerRolled::class to "villages.player.rolled.v1",
        PlayerTookAction::class to "villages.player.tookAction.v1",
        HouseNamedSeat::class to "villages.house.namedSeat.v1",
        HouseLostSeat::class to "villages.house.lostSeat.v1",
        StructureRaised::class to "villages.structure.raised.v1",
        StructureChangedHands::class to "villages.structure.changedHands.v1",
        StructureLevelChanged::class to "villages.structure.levelChanged.v1",
        StructureRuined::class to "villages.structure.ruined.v1",
        StructureRebuilt::class to "villages.structure.rebuilt.v1",
    )

    private val byType: Map<String, KClass<out Event>> = rows.entries.associate { (klass, type) -> type to klass }

    override fun getCloudEventType(type: Class<out Event>): String =
        rows[type.kotlin] ?: throw IllegalArgumentException("${type.simpleName} has no catalogued type")

    @Suppress("UNCHECKED_CAST")
    override fun <E : Event> getDomainEventType(cloudEventType: String): Class<E> =
        (byType[cloudEventType] ?: throw IllegalArgumentException("$cloudEventType is not a catalogued event")).java as Class<E>
}
