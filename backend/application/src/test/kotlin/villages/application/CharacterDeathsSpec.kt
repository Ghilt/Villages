package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import villages.domain.Banner
import villages.domain.CharacterDied
import villages.domain.CharacterId
import villages.domain.Charge
import villages.domain.Division
import villages.domain.FoundHouse
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

/** The losses written, which is what the listener is for. */
private fun TinyWorld.losses(): List<StoredEvent> = stored.filter { it.event is HouseLostKeyFigure }

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

    fun found(world: TinyWorld, player: PlayerId) = world.execute(
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
        val world: TinyWorld,
        val later: ManualLater,
        val keyFigures: KeyFigureService,
        val characterDeaths: CharacterDeaths,
        val faults: KeptFaults,
    )

    fun rig(): Rig {
        val world = TinyWorld()
        val later = ManualLater()
        val keyFigures = KeyFigureService(world, world, { noon }, { today }, calendar, { 1 }, { emptyList() })
        found(world, ada)
        found(world, bea)
        val faults = KeptFaults()
        return Rig(world, later, keyFigures, CharacterDeaths(world, later, faults, keyFigures).started(), faults)
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

        val again = ManualLater()
        CharacterDeaths(rig.world, again, rig.faults, rig.keyFigures).started().use {
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

        rig.characterDeaths.hear(tie)
        rig.characterDeaths.hear(death)
        rig.later.tick()

        rig.world.losses().shouldBeEmpty()
    }
})
