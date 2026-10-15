package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.CompleteDialogueStep
import villages.domain.DialogueNode
import villages.domain.Division
import villages.domain.FoundHouse
import villages.domain.HandOver
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.LevelSpec
import villages.domain.LineId
import villages.domain.Location
import villages.domain.ObjectiveId
import villages.domain.OfferQuest
import villages.domain.PlayerId
import villages.domain.PlayerMetQuestObjective
import villages.domain.QuestId
import villages.domain.RaiseStructure
import villages.domain.Ruin
import villages.domain.Significance
import villages.domain.StructureCatalogue
import villages.domain.StructureId
import villages.domain.StructureSpec
import villages.domain.StructureType
import villages.domain.Tincture
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID

/** The objectives the world ticked, which is what the listener is for. */
private fun TinyWorld.ticks(): List<StoredEvent> = stored.filter { it.event is PlayerMetQuestObjective }

class QuestObjectivesSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val today = WorldTime(653_705)
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val house = HouseId.of(ada)
    val catalogue = StructureCatalogue(
        mapOf(StructureType("castle") to StructureSpec(listOf(LevelSpec(Significance(20.0), 34.0, emptyMap())), emptyList())),
    )
    // Everything south of sixty is an island, so a test can stand a castle on one or not.
    val islands = Islands { place -> place.lat < -60 }
    val onAnIsland = Location(-70.0, 10.0)
    val onAContinent = Location(50.0, 10.0)
    val abbot = SampleQuests.named(SampleQuests.ABBOT, QuestId.offered(house, UUID.fromString("1c000007-0000-4000-8000-000000000070")))
    val gate = (abbot.start() as DialogueNode).dialogue.id

    class Rig(val world: TinyWorld, val later: ManualLater, val faults: KeptFaults)

    fun founded(): Rig {
        val world = TinyWorld(catalogue)
        world.execute(
            FoundHouse(house, ada, HouseName("Ravenscar"), Location(59.33, 18.07), Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT), today, noon),
            Provenance.startedBy(UUID.randomUUID()),
        )
        return Rig(world, ManualLater(), KeptFaults())
    }

    fun Rig.listening(): QuestObjectives =
        QuestObjectives(world, later, faults, WipeGate(), world, { noon }, { today }, islands).started()

    fun Rig.offered() = world.execute(OfferQuest(house, abbot, today, noon), Provenance.startedBy(UUID.randomUUID()))

    fun Rig.answeredBadly() {
        world.execute(CompleteDialogueStep(house, gate, LineId("coffers"), today, noon), Provenance.startedBy(UUID.randomUUID()))
        world.execute(CompleteDialogueStep(house, gate, LineId("doubts"), today, noon), Provenance.startedBy(UUID.randomUUID()))
    }

    fun Rig.raise(n: Int, at: Location, holder: HouseId?, story: UUID = UUID.randomUUID()): StructureId {
        val id = StructureId(UUID.fromString("5e000000-0000-4000-8000-%012d".format(n)))
        world.execute(RaiseStructure(id, StructureType("castle"), "Castle $n", at, 1, holder, today, noon), Provenance.startedBy(story))
        return id
    }

    "a castle raised for the house on an island ticks the castle, in the story of the raising" {
        val rig = founded()
        rig.listening()
        rig.offered()
        rig.answeredBadly()
        val story = UUID.fromString("5e000000-0000-4000-8000-0000000000ff")

        rig.raise(1, onAnIsland, house, story)
        rig.later.tick()

        val tick = rig.world.ticks().single()
        (tick.event as PlayerMetQuestObjective).objectiveId shouldBe ObjectiveId("castle")
        tick.correlationId shouldBe story.toString()
        rig.faults.reported.shouldBeEmpty()
    }

    "a castle on a continent ticks nothing, and a castle on an island handed to the house later does" {
        val rig = founded()
        rig.listening()
        rig.offered()
        rig.answeredBadly()

        rig.raise(1, onAContinent, house)
        val nobodys = rig.raise(2, onAnIsland, null)
        rig.later.tick()
        rig.world.ticks().shouldBeEmpty()

        rig.world.execute(HandOver(nobodys, house, today, noon), Provenance.startedBy(UUID.randomUUID()))
        rig.later.tick()
        rig.world.ticks().map { (it.event as PlayerMetQuestObjective).objectiveId } shouldBe listOf(ObjectiveId("castle"))
    }

    "a house that holds one already has it ticked as soon as the quest reaches the checklist, and a ruin holds nothing" {
        val held = founded()
        held.listening()
        held.raise(1, onAnIsland, house)
        held.offered()
        held.later.tick()
        held.world.ticks().shouldBeEmpty()
        held.answeredBadly()
        held.later.tick()
        held.world.ticks().size shouldBe 1

        val ruined = founded()
        ruined.listening()
        val castle = ruined.raise(1, onAnIsland, house)
        ruined.world.execute(Ruin(castle, "fire", today, noon), Provenance.startedBy(UUID.randomUUID()))
        ruined.offered()
        ruined.answeredBadly()
        ruined.later.tick()
        ruined.world.ticks().shouldBeEmpty()
    }

    "caught up, it ticks what the history says is met and unticked, once, and a second listener ticks nothing again" {
        val rig = founded()
        rig.raise(1, onAnIsland, house)
        rig.offered()
        rig.answeredBadly()

        rig.listening()
        rig.later.tick()
        rig.world.ticks().size shouldBe 1

        rig.listening()
        rig.later.tick()
        rig.world.ticks().size shouldBe 1
        rig.faults.reported.shouldBeEmpty()
    }
})
