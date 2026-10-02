package villages.application

import villages.domain.CharacterCommand
import villages.domain.CharacterDecider
import villages.domain.CharacterEvent
import villages.domain.CharacterId
import villages.domain.Event
import villages.domain.House
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseEvent
import villages.domain.HouseId
import java.util.UUID

/*
 * What the tests of everything acting on its own stand on, one set for all of them: a world of both kinds of
 * stream, a `Later` that waits for the test, and a board that keeps the faults it is told.
 */

/**
 * Houses and characters folded in memory with their real deciders, telling their subscribers every event as it is
 * written; able to be told of an event from anywhere else, as though another stream had written it; and counting
 * the commands it is asked to run, refused or not.
 */
internal class TinyWorld : HouseCommandExecutor, CharacterCommandExecutor, EventFeed {
    private val houses = mutableMapOf<HouseId, MutableList<HouseEvent>>()
    private val characters = mutableMapOf<CharacterId, MutableList<CharacterEvent>>()
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()
    val stored = mutableListOf<StoredEvent>()
    var commands = 0
        private set

    override fun execute(command: HouseCommand, provenance: Provenance) {
        commands++
        val held = houses.getOrPut(command.houseId) { mutableListOf() }
        HouseDecider.decide(command, HouseDecider.fold(held)).forEach { event ->
            held += event
            tell(event, command.houseId.stream, held.size.toLong(), provenance)
        }
    }

    override fun execute(command: CharacterCommand, provenance: Provenance) {
        commands++
        val held = characters.getOrPut(command.characterId) { mutableListOf() }
        CharacterDecider.decide(command, CharacterDecider.fold(held)).forEach { event ->
            held += event
            tell(event, command.characterId.stream, held.size.toLong(), provenance)
        }
    }

    /** An event from some other stream, arriving on the feed in the story given. */
    fun hear(event: Event, story: UUID): StoredEvent =
        tell(event, ELSEWHERE, stored.count { it.stream == ELSEWHERE } + 1L, Provenance(UUID.randomUUID(), story))

    /** A house as its stream folds, which has to have been founded. */
    fun founded(id: HouseId): House.Founded = HouseDecider.fold(houses[id].orEmpty()) as House.Founded

    /** Empties every stream, as a wipe does. Whoever is subscribed stays subscribed, as to the real feed. */
    fun wipe() {
        houses.clear()
        characters.clear()
        stored.clear()
    }

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        if (from == Start.FROM_THE_BEGINNING) {
            stored.toList().forEach(subscriber)
        }
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    private fun tell(event: Event, stream: String, version: Long, provenance: Provenance): StoredEvent {
        val written = StoredEvent(
            id = UUID.randomUUID().toString(),
            type = event::class.simpleName!!,
            stream = stream,
            streamVersion = version,
            time = event.recordedAt,
            data = "{}",
            correlationId = provenance.correlationId.toString(),
            causationId = provenance.commandId.toString(),
            event = event,
        )
        stored += written
        subscribers.toList().forEach { it(written) }
        return written
    }

    private companion object {
        const val ELSEWHERE = "elsewhere"
    }
}

/** A `Later` that runs nothing until a test says so, and says how long it was asked to wait. */
internal class ManualLater : Later {
    val waits = mutableListOf<Long>()
    private val planned = mutableListOf<Runnable>()

    override fun schedule(delayMs: Long, action: Runnable) {
        waits += delayMs
        planned += action
    }

    fun tick() {
        val due = planned.toList()
        planned.clear()
        due.forEach { it.run() }
    }
}

/** Faults kept in the order they were told, for a test to read. */
internal class KeptFaults : Faults {
    val reported = mutableListOf<Fault>()

    override fun report(fault: Fault) {
        reported += fault
    }

    override fun watch(listener: (Fault) -> Unit): AutoCloseable = AutoCloseable {}
}
