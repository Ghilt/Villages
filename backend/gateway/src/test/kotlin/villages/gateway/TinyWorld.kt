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
import villages.domain.HouseGainedKeyFigure
import villages.domain.HouseGainedVision
import villages.domain.HouseLostKeyFigure
import villages.domain.HouseLostVision
import villages.domain.HouseResourceGranted
import villages.domain.HouseResourcePledged
import villages.domain.HouseResourceReleased
import villages.domain.HouseIncomeChanged
import villages.domain.HouseResourceSpent
import villages.domain.PlayerCompletedDialogue
import villages.domain.PlayerCompletedDialogueStep
import villages.domain.PlayerGivenChoice
import villages.domain.HouseLostSeat
import villages.domain.HouseNamedSeat
import villages.domain.PlayerLostDialogue
import villages.domain.PlayerOfferedDialogue
import villages.domain.PlayerOfferedQuest
import villages.domain.PlayerMetQuestObjective
import villages.domain.PlayerCompletedQuestNode
import villages.domain.PlayerCompletedQuest
import villages.domain.PlayerRolled
import villages.domain.PlayerTookAction
import villages.domain.StructureCommand
import villages.domain.StructureDecider
import villages.domain.StructureEvent
import java.util.UUID

/** The catalogued type of an event, as the store would name it. */
internal fun typeOf(event: HouseEvent): String = when (event) {
    is HouseFounded -> "villages.house.founded.v1"
    is HouseGainedKeyFigure -> "villages.house.gainedKeyFigure.v1"
    is HouseLostKeyFigure -> "villages.house.lostKeyFigure.v1"
    is HouseGainedVision -> "villages.house.gainedVision.v1"
    is HouseLostVision -> "villages.house.lostVision.v1"
    is HouseNamedSeat -> "villages.house.namedSeat.v1"
    is HouseLostSeat -> "villages.house.lostSeat.v1"
    is HouseResourceGranted -> "villages.house.resourceGranted.v1"
    is HouseResourcePledged -> "villages.house.resourcePledged.v1"
    is HouseResourceReleased -> "villages.house.resourceReleased.v1"
    is HouseIncomeChanged -> "villages.house.incomeChanged.v1"
    is HouseResourceSpent -> "villages.house.resourceSpent.v1"
    is PlayerGivenChoice -> "villages.player.givenChoice.v1"
    is PlayerOfferedDialogue -> "villages.player.offeredDialogue.v1"
    is PlayerCompletedDialogueStep -> "villages.player.completedDialogueStep.v1"
    is PlayerCompletedDialogue -> "villages.player.completedDialogue.v1"
    is PlayerLostDialogue -> "villages.player.lostDialogue.v1"
    is PlayerOfferedQuest -> "villages.player.offeredQuest.v1"
    is PlayerMetQuestObjective -> "villages.player.metQuestObjective.v1"
    is PlayerCompletedQuestNode -> "villages.player.completedQuestNode.v1"
    is PlayerCompletedQuest -> "villages.player.completedQuest.v1"
    is PlayerRolled -> "villages.player.rolled.v1"
    is PlayerTookAction -> "villages.player.tookAction.v1"
}

/** Enough of the data for the panel's sake. The stored form proper is pinned by its own fixture. */
internal fun dataOf(event: HouseEvent): String = when (event) {
    is HouseFounded -> """{"name":"${event.name.value}","significance":${event.significance.value}}"""
    is HouseGainedKeyFigure -> """{"characterId":"${event.characterId.value}"}"""
    is HouseLostKeyFigure -> """{"characterId":"${event.characterId.value}"}"""
    is HouseGainedVision -> """{"visionId":"${event.visionId.value}"}"""
    is HouseLostVision -> """{"visionId":"${event.visionId.value}"}"""
    is HouseNamedSeat -> """{"structureId":"${event.structureId.value}"}"""
    is HouseLostSeat -> """{"structureId":"${event.structureId.value}"}"""
    is HouseResourceGranted -> """{"resource":"${event.resource}","amount":${event.amount}}"""
    is HouseResourcePledged -> """{"resource":"${event.resource}","amount":${event.amount}}"""
    is HouseResourceReleased -> """{"pledgeId":"${event.pledgeId.value}"}"""
    is HouseIncomeChanged -> """{"source":"${event.source}"}"""
    is HouseResourceSpent -> """{"resource":"${event.resource}","amount":${event.amount}}"""
    is PlayerGivenChoice -> """{"prompt":"${event.choice.prompt}","options":${event.choice.options.size}}"""
    is PlayerOfferedDialogue -> """{"title":"${event.dialogue.title}","lines":${event.dialogue.lines.size}}"""
    is PlayerCompletedDialogueStep -> """{"lineId":"${event.lineId.value}"}"""
    is PlayerCompletedDialogue -> """{"dialogueId":"${event.dialogueId.value}"}"""
    is PlayerLostDialogue -> """{"dialogueId":"${event.dialogueId.value}"}"""
    is PlayerOfferedQuest -> """{"title":"${event.quest.title}","nodes":${event.quest.nodes.size}}"""
    is PlayerMetQuestObjective -> """{"objectiveId":"${event.objectiveId.value}"}"""
    is PlayerCompletedQuestNode -> """{"nodeId":"${event.nodeId.value}","onto":"${event.onto?.value}"}"""
    is PlayerCompletedQuest -> """{"questId":"${event.questId.value}"}"""
    is PlayerRolled -> """{"rarity":"${event.rarity}","omens":${event.omens.size}}"""
    is PlayerTookAction -> """{"optionId":"${event.optionId.value}"}"""
}

/** A character's events, catalogued the same way; the panel's copy of their data is not what is tested here. */
internal fun typeOf(event: CharacterEvent): String =
    "villages.character.${event::class.simpleName!!.removePrefix("Character").replaceFirstChar { it.lowercase() }}.v1"

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
