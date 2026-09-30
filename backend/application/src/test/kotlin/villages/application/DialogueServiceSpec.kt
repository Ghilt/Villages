package villages.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.domain.Banner
import villages.domain.CharacterId
import villages.domain.CharacterName
import villages.domain.Charge
import villages.domain.DialogueId
import villages.domain.Division
import villages.domain.Effect
import villages.domain.FoundHouse
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseError
import villages.domain.HouseEvent
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.LineId
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.PlayerOfferedDialogue
import villages.domain.Requirement
import villages.domain.Resource
import villages.domain.Sex
import villages.domain.Species
import villages.domain.Stat
import villages.domain.TakeKeyFigure
import villages.domain.Tincture
import villages.domain.WorldTime
import villages.domain.walk
import java.time.Instant
import java.util.UUID

/** Houses folded in memory with their real decider, and every event written, with the provenance it came in. */
private class Houses : HouseCommandExecutor {
    val streams = mutableMapOf<HouseId, MutableList<HouseEvent>>()
    val written = mutableListOf<Pair<HouseEvent, Provenance>>()

    override fun execute(command: HouseCommand, provenance: Provenance) {
        val held = streams.getOrPut(command.houseId) { mutableListOf() }
        val decided = HouseDecider.decide(command, HouseDecider.fold(held))
        held += decided
        decided.forEach { written += it to provenance }
    }
}

class DialogueServiceSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val today = WorldTime(653_705)
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val house = HouseId.of(ada)
    val agnes = CharacterRow(
        id = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f")),
        name = CharacterName("Agnes", "Hollin"),
        sex = Sex.WOMAN,
        species = Species.PERSON,
        bornOn = WorldTime(642_700),
        agedYears = 0,
        stats = mapOf(Stat.PIETY to 13, Stat.REASON to 9, Stat.KINDNESS to 11, Stat.PHYSICAL to 7),
        portrait = "woman-03",
        appearedOn = today,
        diedOn = null,
        keyFigureOf = emptyList(),
        revision = 1,
    )
    val sent = UUID.fromString("1c000007-0000-4000-8000-000000000040")

    /** A founded house, holding [held] as key figures in its own history, and a read model that says so. */
    fun rig(vararg held: CharacterRow): Pair<Houses, DialogueService> {
        val houses = Houses()
        houses.execute(
            FoundHouse(
                houseId = house,
                player = ada,
                name = HouseName("Ravenscar"),
                seat = Location(59.33, 18.07),
                banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
                worldTime = today,
                recordedAt = noon,
            ),
            Provenance.startedBy(UUID.randomUUID()),
        )
        for (figure in held) {
            houses.execute(TakeKeyFigure(house, figure.id, today, noon), Provenance.startedBy(UUID.randomUUID()))
        }
        houses.written.clear()
        val readModel = object : KeyFiguresByHouse {
            override fun of(house: HouseId) = held.toList()
            override fun watch(listener: (KeyFiguresChange) -> Unit) = AutoCloseable {}
        }
        return houses to DialogueService(houses, readModel, { noon }, { today })
    }

    "the letter is offered to the player's house, spoken by its first key figure, in the command's story" {
        val (houses, service) = rig(agnes)

        val id = service.offerSample(ada, SampleDialogues.LETTER, Provenance.startedBy(sent))

        id shouldBe DialogueId.offered(house, sent)
        val (event, provenance) = houses.written.single()
        val offered = event.shouldBeInstanceOf<PlayerOfferedDialogue>()
        offered.player shouldBe ada
        offered.dialogue.id shouldBe id
        offered.dialogue.speakers.first { it.character == agnes.id }.let { speaker ->
            speaker.name shouldBe "Agnes Hollin"
            speaker.portrait shouldBe "woman-03"
        }
        offered.dialogue.needs() shouldBe setOf(Requirement.Alive(agnes.id))
        provenance.correlationId shouldBe sent
    }

    "one answer pays a purse and the other pays nothing" {
        val (houses, service) = rig(agnes)
        service.offerSample(ada, SampleDialogues.LETTER, Provenance.startedBy(sent))
        val letter = (houses.written.single().first as PlayerOfferedDialogue).dialogue

        val paid = letter.walk(listOf(LineId("accept"), LineId("paid")))
        val unpaid = letter.walk(listOf(LineId("refuse"), LineId("shrugs")))

        paid.over shouldBe true
        paid.said.flatMap { it.gives } shouldBe listOf(Effect.Grant(Resource.WEALTH, SampleDialogues.DUES))
        unpaid.over shouldBe true
        unpaid.said.flatMap { it.gives } shouldBe emptyList()
    }

    "a house with no key figure is refused, because the letter is theirs to answer" {
        val (houses, service) = rig()

        shouldThrow<HouseError.NoSuchKeyFigure> {
            service.offerSample(ada, SampleDialogues.LETTER, Provenance.startedBy(sent))
        }
        houses.written shouldBe emptyList()
    }

    "the same command sent again is refused as already offered, rather than offering the letter twice" {
        val (houses, service) = rig(agnes)
        service.offerSample(ada, SampleDialogues.LETTER, Provenance.startedBy(sent))

        shouldThrow<HouseError.DialogueAlreadyOffered> {
            service.offerSample(ada, SampleDialogues.LETTER, Provenance.startedBy(sent))
        }
        houses.written.count { it.first is PlayerOfferedDialogue } shouldBe 1
    }

    "a sample that does not exist is not asked of the house at all" {
        val (houses, service) = rig(agnes)

        shouldThrow<IllegalArgumentException> { service.offerSample(ada, "a song", Provenance.startedBy(sent)) }
        houses.written shouldBe emptyList()
    }
})
