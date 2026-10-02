package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import villages.domain.Banner
import villages.domain.CharacterDied
import villages.domain.CharacterId
import villages.domain.Charge
import villages.domain.Dialogue
import villages.domain.DialogueId
import villages.domain.Division
import villages.domain.Event
import villages.domain.FoundHouse
import villages.domain.HouseId
import villages.domain.HouseLostKeyFigure
import villages.domain.HouseName
import villages.domain.Line
import villages.domain.LineId
import villages.domain.CompleteDialogueStep
import villages.domain.Location
import villages.domain.OfferDialogue
import villages.domain.PlayerId
import villages.domain.PlayerLostDialogue
import villages.domain.Requirement
import villages.domain.Speaker
import villages.domain.SpeakerId
import villages.domain.Then
import villages.domain.Tincture
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID

/** The dialogues lost, which is what the listener is for. */
private fun TinyWorld.losses(): List<StoredEvent> = stored.filter { it.event is PlayerLostDialogue }

class BrokenRequirementsSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val today = WorldTime(653_705)
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val bea = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8e"))
    val agnes = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))
    val story = UUID.fromString("57000000-0000-4000-8000-0000000000ff")
    val her = Speaker(SpeakerId("agnes"), party = 0, name = "Agnes Hollin", portrait = null, character = agnes)
    val messenger = Speaker(SpeakerId("messenger"), party = 1, name = "A messenger", portrait = null, character = null)

    fun spokenBy(house: HouseId, speaker: Speaker, n: Int) = Dialogue(
        id = DialogueId.offered(house, UUID.fromString("1c000007-0000-4000-8000-00000000006$n")),
        title = "Spoken by ${speaker.name}",
        scene = null,
        speakers = listOf(speaker, messenger).distinct(),
        lines = listOf(Line(LineId("only"), speaker.id, "A word.", then = Then.End)),
    )

    class Rig(val world: TinyWorld, val later: ManualLater, val listener: BrokenRequirements, val faults: KeptFaults)

    fun rig(breaks: ((Event) -> Set<Requirement>?)? = null): Rig {
        val world = TinyWorld()
        val later = ManualLater()
        val faults = KeptFaults()
        for (player in listOf(ada, bea)) {
            world.execute(
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
        }
        val listener = if (breaks == null) {
            BrokenRequirements(world, later, faults, world, { noon }, { today }).started()
        } else {
            BrokenRequirements(world, later, faults, world, { noon }, { today }, { event -> breaks(event).orEmpty() }).started()
        }
        return Rig(world, later, listener, faults)
    }

    fun Rig.offer(player: PlayerId, speaker: Speaker, n: Int): Dialogue {
        val dialogue = spokenBy(HouseId.of(player), speaker, n)
        world.execute(OfferDialogue(HouseId.of(player), dialogue, today, noon), Provenance.startedBy(UUID.randomUUID()))
        return dialogue
    }

    fun Rig.kill() = world.hear(CharacterDied(agnes, "a fever", today, noon), story)

    "a speaker's death lapses every dialogue they speak in, in every house, in the death's story and caused by it" {
        val rig = rig()
        val hers = rig.offer(ada, her, 1)
        val alsoHers = rig.offer(bea, her, 2)
        val theMessengers = rig.offer(ada, messenger, 3)

        val death = rig.kill()
        rig.world.losses() shouldBe emptyList()
        rig.later.tick()

        val losses = rig.world.losses()
        losses.map { (it.event as PlayerLostDialogue).dialogueId }.toSet() shouldBe setOf(hers.id, alsoHers.id)
        losses.map { (it.event as PlayerLostDialogue).dialogueId }.contains(theMessengers.id) shouldBe false
        losses.forEach {
            (it.event as PlayerLostDialogue).because shouldBe Requirement.Alive(agnes)
            it.correlationId shouldBe story.toString()
            it.causationId shouldBe death.id
        }
    }

    "a dialogue offered with a speaker already dead lapses at once, in the death's story" {
        val rig = rig()
        rig.kill()
        rig.later.tick()

        val late = rig.offer(ada, her, 1)
        rig.later.tick()

        val loss = rig.world.losses().single()
        (loss.event as PlayerLostDialogue).dialogueId shouldBe late.id
        loss.correlationId shouldBe story.toString()
    }

    "a death no open dialogue needs writes nothing, and nor does one after the dialogue is finished" {
        val rig = rig()
        val hers = rig.offer(ada, her, 1)
        rig.world.execute(
            CompleteDialogueStep(HouseId.of(ada), hers.id, LineId("only"), today, noon),
            Provenance.startedBy(UUID.randomUUID()),
        )
        rig.offer(bea, messenger, 2)

        rig.kill()
        rig.later.tick()

        rig.world.losses() shouldBe emptyList()
    }

    "a replay from the beginning writes nothing twice" {
        val rig = rig()
        rig.offer(ada, her, 1)
        rig.kill()
        rig.later.tick()
        val before = rig.world.stored.size

        val again = ManualLater()
        BrokenRequirements(rig.world, again, rig.faults, rig.world, { noon }, { today }).started().use {
            again.tick()
        }

        rig.world.stored shouldHaveSize before
    }

    "it knows no kinds: a made-up rule of what breaks what is carried the same way" {
        // A rule nobody would write - losing a key figure breaks their being alive - to show that nothing here
        // knows which event breaks which requirement: the rule is handed in, and followed.
        val rig = rig { event -> (event as? HouseLostKeyFigure)?.let { setOf(Requirement.Alive(it.characterId)) } }
        val hers = rig.offer(ada, her, 1)

        rig.kill()
        rig.later.tick()
        rig.world.losses() shouldBe emptyList()

        rig.world.hear(HouseLostKeyFigure(HouseId.of(ada), agnes, today, noon), story)
        rig.later.tick()
        (rig.world.losses().single().event as PlayerLostDialogue).dialogueId shouldBe hers.id
    }

    "a house that is no longer there is no trouble" {
        val rig = rig()
        val nowhere = HouseId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-000000000000"))
        val offered = StoredEvent(
            "2c000000-0000-4000-8000-000000000001", "t", "house:x", 1, noon, "{}", "1", "1",
            villages.domain.PlayerOfferedDialogue(nowhere, ada, spokenBy(nowhere, her, 1), today, noon),
        )

        rig.listener.hear(offered)
        rig.kill()
        rig.later.tick()

        rig.world.losses() shouldBe emptyList()
    }
})
