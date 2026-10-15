package villages.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.DialogueNode
import villages.domain.Division
import villages.domain.FoundHouse
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseError
import villages.domain.HouseEvent
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.NodeId
import villages.domain.PlayerId
import villages.domain.PlayerOfferedDialogue
import villages.domain.PlayerOfferedQuest
import villages.domain.QuestId
import villages.domain.Tincture
import villages.domain.WorldTime
import villages.domain.walk
import java.time.Instant
import java.util.UUID

/** Houses folded in memory with their real decider, and every event written, with the provenance it came in. */
private class QuestHouses : HouseCommandExecutor {
    val streams = mutableMapOf<HouseId, MutableList<HouseEvent>>()
    val written = mutableListOf<Pair<HouseEvent, Provenance>>()

    override fun execute(command: HouseCommand, provenance: Provenance) {
        val held = streams.getOrPut(command.houseId) { mutableListOf() }
        val decided = HouseDecider.decide(command, HouseDecider.fold(held))
        held += decided
        decided.forEach { written += it to provenance }
    }
}

class QuestServiceSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val today = WorldTime(653_705)
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val house = HouseId.of(ada)
    val sent = UUID.fromString("1c000007-0000-4000-8000-000000000050")

    fun rig(founded: Boolean = true): Pair<QuestHouses, QuestService> {
        val houses = QuestHouses()
        if (founded) {
            val banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT)
            houses.execute(
                FoundHouse(house, ada, HouseName("Ravenscar"), Location(59.33, 18.07), banner, today, noon),
                Provenance.startedBy(UUID.randomUUID()),
            )
            houses.written.clear()
        }
        return houses to QuestService(houses, clock = { noon }, world = { today })
    }

    "the player's house is offered the abbot whole, and its first dialogue in the same story" {
        val (houses, service) = rig()

        val id = service.offerSample(ada, SampleQuests.ABBOT, Provenance.startedBy(sent))

        id shouldBe QuestId.offered(house, sent)
        houses.written.map { it.first::class } shouldBe listOf(PlayerOfferedQuest::class, PlayerOfferedDialogue::class)
        houses.written.map { it.second }.toSet() shouldBe setOf(Provenance.startedBy(sent))
        val quest = houses.written.first().first.shouldBeInstanceOf<PlayerOfferedQuest>().quest
        quest.id shouldBe id
        (houses.written.last().first as PlayerOfferedDialogue).dialogue shouldBe (quest.start() as DialogueNode).dialogue
    }

    "the abbot's map at the start: two question marks ahead, the consecration one shown ahead, the blessing in view" {
        val quest = SampleQuests.named(SampleQuests.ABBOT, QuestId.offered(house, sent))
        val start = quest.walk(emptyList())
        val every = quest.nodes.map { it.id }

        every.filter(start::isDrawn) shouldBe every
        every.filter(start::isQuestionMark) shouldBe listOf(NodeId("gift"), NodeId("light"), NodeId("consecration"))
    }

    "the same command sent twice is refused as already offered rather than doubled" {
        val (_, service) = rig()
        service.offerSample(ada, SampleQuests.ABBOT, Provenance.startedBy(sent))

        shouldThrow<HouseError.QuestAlreadyOffered> { service.offerSample(ada, SampleQuests.ABBOT, Provenance.startedBy(sent)) }
    }

    "a house that does not exist is refused, and a name that is not a sample before anything is asked" {
        val (houses, service) = rig(founded = false)

        shouldThrow<HouseError.NoSuchHouse> { service.offerSample(ada, SampleQuests.ABBOT, Provenance.startedBy(sent)) }
        shouldThrow<IllegalArgumentException> { service.offerSample(ada, "nonesuch", Provenance.startedBy(sent)) }
        houses.written shouldBe emptyList()
    }
})
