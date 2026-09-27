package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import villages.domain.Banner
import villages.domain.CharacterCommand
import villages.domain.CharacterDecider
import villages.domain.CharacterDied
import villages.domain.CharacterEvent
import villages.domain.CharacterId
import villages.domain.Charge
import villages.domain.Division
import villages.domain.Event
import villages.domain.FoundHouse
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseEvent
import villages.domain.HouseGainedKeyFigure
import villages.domain.HouseId
import villages.domain.HouseLostKeyFigure
import villages.domain.HouseName
import villages.domain.KillCharacter
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.TakeKeyFigure
import villages.domain.Tincture
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID

/** Both kinds of stream, folded in memory, telling their subscribers every event as it is written. */
private class CharacterDeathsWorld : HouseCommandExecutor, CharacterCommandExecutor, EventFeed {
    private val houses = mutableMapOf<HouseId, MutableList<HouseEvent>>()
    private val characters = mutableMapOf<CharacterId, MutableList<CharacterEvent>>()
    val stored = mutableListOf<StoredEvent>()
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun execute(command: HouseCommand, provenance: Provenance) {
        val held = houses.getOrPut(command.houseId) { mutableListOf() }
        HouseDecider.decide(command, HouseDecider.fold(held)).forEach { event ->
            held += event
            tell(event, "house:${command.houseId.value}", held.size, provenance)
        }
    }

    override fun execute(command: CharacterCommand, provenance: Provenance) {
        val held = characters.getOrPut(command.characterId) { mutableListOf() }
        CharacterDecider.decide(command, CharacterDecider.fold(held)).forEach { event ->
            held += event
            tell(event, command.characterId.stream, held.size, provenance)
        }
    }

    private fun tell(event: Event, stream: String, version: Int, provenance: Provenance) {
        val written = StoredEvent(
            id = UUID.randomUUID().toString(),
            type = event::class.simpleName!!,
            stream = stream,
            streamVersion = version.toLong(),
            time = event.recordedAt,
            data = "{}",
            correlationId = provenance.correlationId.toString(),
            causationId = provenance.commandId.toString(),
            event = event,
        )
        stored += written
        subscribers.toList().forEach { it(written) }
    }

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        if (from == Start.FROM_THE_BEGINNING) {
            stored.toList().forEach(subscriber)
        }
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    fun losses(): List<StoredEvent> = stored.filter { it.event is HouseLostKeyFigure }
}

/** A `Later` that runs nothing until a test says so. */
private class HeldLater : Later {
    private val planned = mutableListOf<Runnable>()

    override fun schedule(delayMs: Long, action: Runnable) {
        planned += action
    }

    fun tick() {
        val due = planned.toList()
        planned.clear()
        due.forEach { it.run() }
    }
}

class CharacterDeathsSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val today = WorldTime(653_705)
    val calendar = object : WorldCalendar {
        override fun plusMonths(day: WorldTime, months: Long) = WorldTime(day.day + months * 30)
        override fun monthsBetween(from: WorldTime, to: WorldTime) = (to.day - from.day) / 30
    }
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val bea = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8e"))
    val story = UUID.fromString("57000000-0000-4000-8000-0000000000ff")

    fun found(world: CharacterDeathsWorld, player: PlayerId) = world.execute(
        FoundHouse(
            houseId = HouseId.of(player),
            player = player,
            name = HouseName("Ravenscar"),
            seat = Location(59.33, 18.07),
            banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
            worldTime = today,
            recordedAt = noon,
        ),
        Provenance.startedBy(UUID.randomUUID()),
    )

    class Rig(
        val world: CharacterDeathsWorld,
        val later: HeldLater,
        val keyFigures: KeyFigureService,
        val characterDeaths: CharacterDeaths,
    )

    fun rig(): Rig {
        val world = CharacterDeathsWorld()
        val later = HeldLater()
        val keyFigures = KeyFigureService(world, world, { noon }, { today }, calendar, { 1 }, { emptyList() })
        found(world, ada)
        found(world, bea)
        return Rig(world, later, keyFigures, CharacterDeaths(world, later, keyFigures))
    }

    "a death writes the loss into every house that held them, in the death's story, and caused by it" {
        val rig = rig()
        val agnes = rig.keyFigures.add(ada, Provenance.startedBy(UUID.randomUUID()))
        rig.world.execute(TakeKeyFigure(HouseId.of(bea), agnes, today, noon), Provenance.startedBy(UUID.randomUUID()))

        rig.world.execute(KillCharacter(agnes, "a fever", today, noon), Provenance(UUID.randomUUID(), story))
        rig.world.losses().shouldBeEmpty()
        rig.later.tick()

        val death = rig.world.stored.single { it.event is CharacterDied }
        val losses = rig.world.losses()
        losses.map { (it.event as HouseLostKeyFigure).houseId }.toSet() shouldBe setOf(HouseId.of(ada), HouseId.of(bea))
        losses.forEach {
            it.correlationId shouldBe story.toString()
            it.causationId shouldBe death.id
        }
    }

    "a tie made to somebody already dead is undone, whichever of the two the feed brings first" {
        val rig = rig()
        val agnes = rig.keyFigures.add(ada, Provenance.startedBy(UUID.randomUUID()))
        rig.world.execute(KillCharacter(agnes, "a fever", today, noon), Provenance(UUID.randomUUID(), story))
        rig.later.tick()
        rig.world.losses() shouldHaveSize 1

        rig.world.execute(TakeKeyFigure(HouseId.of(bea), agnes, today, noon), Provenance.startedBy(UUID.randomUUID()))
        rig.later.tick()

        val late = rig.world.losses().map { it.event as HouseLostKeyFigure }.single { it.houseId == HouseId.of(bea) }
        late.characterId shouldBe agnes
        rig.world.losses().last().correlationId shouldBe story.toString()
    }

    "a replay from the beginning writes nothing twice" {
        val rig = rig()
        val agnes = rig.keyFigures.add(ada, Provenance.startedBy(UUID.randomUUID()))
        rig.world.execute(KillCharacter(agnes, "a fever", today, noon), Provenance(UUID.randomUUID(), story))
        rig.later.tick()
        val before = rig.world.stored.size

        val again = HeldLater()
        CharacterDeaths(rig.world, again, rig.keyFigures).use {
            again.tick()
        }

        rig.world.stored shouldHaveSize before
    }

    "a house that is no longer there is no trouble" {
        val rig = rig()
        val nowhere = HouseId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-000000000000"))
        val agnes = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))
        val tie = StoredEvent("1", "t", "house:x", 1, noon, "{}", "1", "1", HouseGainedKeyFigure(nowhere, agnes, today, noon))
        val death = StoredEvent(
            "2c000000-0000-4000-8000-000000000002", "t", "character:x", 1, noon, "{}", story.toString(), "2",
            CharacterDied(agnes, "a fever", today, noon),
        )

        rig.characterDeaths.apply(tie)
        rig.characterDeaths.apply(death)
        rig.later.tick()

        rig.world.losses().shouldBeEmpty()
    }
})
