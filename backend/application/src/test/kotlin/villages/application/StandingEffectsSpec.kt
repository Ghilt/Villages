package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.ints.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
import villages.domain.Banner
import villages.domain.ChangeLevel
import villages.domain.Charge
import villages.domain.Division
import villages.domain.FoundHouse
import villages.domain.HandOver
import villages.domain.HouseGainedVision
import villages.domain.HouseId
import villages.domain.HouseLostVision
import villages.domain.HouseName
import villages.domain.LevelSpec
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.RaiseStructure
import villages.domain.Ruin
import villages.domain.Significance
import villages.domain.StructureCatalogue
import villages.domain.StructureId
import villages.domain.StructureSpec
import villages.domain.StructureType
import villages.domain.Tincture
import villages.domain.VisionId
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID

/** What a structure lets its holder see, written into the holder's history by the standing-effects listener. */
class StandingEffectsSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val today = WorldTime(653_705)
    val mill = StructureType("mill")
    val catalogue = StructureCatalogue(
        mapOf(mill to StructureSpec(listOf(LevelSpec(Significance(8.0), 6.0, emptyMap()), LevelSpec(Significance(10.0), 8.0, emptyMap())), emptyList())),
    )
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val bea = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8e"))
    val theMill = StructureId(UUID.fromString("5d000000-0000-4000-8000-000000000001"))
    val dantzic = Location(54.36, 18.64)

    fun found(world: TinyWorld, player: PlayerId) = world.execute(
        FoundHouse(
            HouseId.of(player), player, HouseName("Ravenscar"), Location(59.33, 18.07),
            Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT), today, noon,
        ),
        Provenance.startedBy(UUID.randomUUID()),
    )

    fun raise(world: TinyWorld, holder: PlayerId?, level: Int = 1) = world.execute(
        RaiseStructure(theMill, mill, "the mill at Dantzic", dantzic, level, holder?.let(HouseId::of), today, noon),
        Provenance.startedBy(UUID.randomUUID()),
    )

    fun handOver(world: TinyWorld, to: PlayerId?) =
        world.execute(HandOver(theMill, to?.let(HouseId::of), today, noon), Provenance.startedBy(UUID.randomUUID()))

    class Rig(val world: TinyWorld, val later: ManualLater, val faults: KeptFaults)

    fun rig(): Rig {
        val world = TinyWorld(catalogue)
        found(world, ada)
        found(world, bea)
        return Rig(world, ManualLater(), KeptFaults())
    }

    fun Rig.listening(): StandingEffects =
        StandingEffects(world, later, faults, catalogue, VisionService(world, { noon }, { today }, { UUID.randomUUID() })).started()

    fun Rig.gained(player: PlayerId) = world.stored.map { it.event }.filterIsInstance<HouseGainedVision>().filter { it.houseId == HouseId.of(player) }
    fun Rig.lost(player: PlayerId) = world.stored.map { it.event }.filterIsInstance<HouseLostVision>().filter { it.houseId == HouseId.of(player) }

    "a structure handed to a house lets it see from it, as far as its type and level see, and says from where" {
        val rig = rig()
        rig.listening()
        raise(rig.world, holder = null)
        rig.later.tick()
        rig.world.stored.map { it.event }.filterIsInstance<HouseGainedVision>().shouldBeEmpty()

        handOver(rig.world, ada)
        rig.later.tick()

        val seen = rig.gained(ada).single()
        listOf(seen.place, seen.radius, seen.from) shouldBe listOf(dantzic, 6.0, theMill)
        seen.visionId shouldBe VisionId.seenFrom(theMill, HouseId.of(ada), since = 2)
        rig.faults.reported.shouldBeEmpty()
    }

    "raised for a house, it lets the house see from it at once, at the radius of its level" {
        val rig = rig()
        rig.listening()

        raise(rig.world, holder = ada, level = 2)
        rig.later.tick()

        rig.gained(ada).single().radius shouldBe 8.0
    }

    "handed on, the old holder's vision from it is taken back and the new holder's given, whichever runs first" {
        val rig = rig()
        rig.listening()
        raise(rig.world, holder = ada)
        rig.later.tick()

        handOver(rig.world, bea)
        rig.later.tick()

        rig.lost(ada).single().visionId shouldBe rig.gained(ada).single().visionId
        rig.gained(bea).single().from shouldBe theMill
        rig.faults.reported.shouldBeEmpty()
    }

    "the history replayed writes nothing, and a holding whose sight was never written is set right once caught up" {
        val rig = rig()
        rig.listening()
        raise(rig.world, holder = ada)
        rig.later.tick()
        val written = rig.world.stored.size

        rig.listening()
        rig.later.tick()
        rig.world.stored.size shouldBe written

        val older = rig()
        raise(older.world, holder = bea)
        older.listening()
        older.later.tick()
        older.gained(bea).single().from shouldBe theMill
    }

    "a structure that goes up a level lets its holder see farther, the new vision given before the old is taken" {
        val rig = rig()
        rig.listening()
        raise(rig.world, holder = ada)
        rig.later.tick()

        rig.world.execute(ChangeLevel(theMill, 1, today, noon), Provenance.startedBy(UUID.randomUUID()))
        rig.later.tick()

        rig.gained(ada).map { it.radius } shouldBe listOf(6.0, 8.0)
        rig.lost(ada).single().visionId shouldBe rig.gained(ada).first().visionId
        val written = rig.world.stored.map { it.event }
        written.indexOfFirst { it is HouseLostVision } shouldBeGreaterThan written.indexOfLast { it is HouseGainedVision }
        rig.faults.reported.shouldBeEmpty()

        rig.world.execute(ChangeLevel(theMill, -1, today, noon), Provenance.startedBy(UUID.randomUUID()))
        rig.later.tick()
        rig.gained(ada).map { it.radius } shouldBe listOf(6.0, 8.0, 6.0)
        rig.lost(ada).size shouldBe 2
    }

    "a structure nobody holds changes level and nobody is given anything" {
        val rig = rig()
        rig.listening()
        raise(rig.world, holder = null)

        rig.world.execute(ChangeLevel(theMill, 1, today, noon), Provenance.startedBy(UUID.randomUUID()))
        rig.later.tick()

        rig.world.stored.map { it.event }.filterIsInstance<HouseGainedVision>().shouldBeEmpty()
    }

    "a structure fallen to ruin takes back its holder's vision from it" {
        val rig = rig()
        rig.listening()
        raise(rig.world, holder = ada)
        rig.later.tick()

        rig.world.execute(Ruin(theMill, "fire", today, noon), Provenance.startedBy(UUID.randomUUID()))
        rig.later.tick()

        rig.lost(ada).single().visionId shouldBe rig.gained(ada).single().visionId
    }
})
