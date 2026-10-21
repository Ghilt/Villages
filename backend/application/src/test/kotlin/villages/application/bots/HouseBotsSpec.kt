package villages.application.bots

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import villages.application.FoundHouseService
import villages.application.HouseCommandExecutor
import villages.application.Opening
import villages.application.Provenance
import villages.application.WorldCommandExecutor
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseEvent
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.WorldBotCreated
import villages.domain.WorldCommand
import villages.domain.WorldDecider
import villages.domain.WorldStreamEvent
import villages.domain.WorldTime
import java.time.Instant

/** The world's own stream in a list, decided by its own rules. */
private class RememberingWorld : WorldCommandExecutor {
    private val decider = WorldDecider { _, _ -> emptyList() }
    val events = mutableListOf<WorldStreamEvent>()

    override fun execute(command: WorldCommand, provenance: Provenance) {
        events += decider.decide(command, decider.fold(events))
    }
}

/** Every house's stream in a list of its own, decided by the house's rules, so founding twice is refused. */
private class RememberingHouses : HouseCommandExecutor {
    val streams = mutableMapOf<HouseId, MutableList<HouseEvent>>()

    override fun execute(command: HouseCommand, provenance: Provenance) {
        val stream = streams.getOrPut(command.houseId) { mutableListOf() }
        stream += HouseDecider.decide(command, HouseDecider.fold(stream))
    }
}

/** The opening and the house bots it makes. See decision record 0108. */
class HouseBotsSpec : StringSpec({
    val noon = Instant.parse("2026-10-21T12:00:00Z")
    val places = listOf(
        HouseBotPlace("Q84", HouseName("London"), Location(52.4, 2.0)),
        HouseBotPlace("Q90", HouseName("Paris"), Location(48.8, 2.9)),
    )

    fun bots(world: WorldCommandExecutor, houses: HouseCommandExecutor, where: List<HouseBotPlace> = places) =
        HouseBots(world, FoundHouseService(houses, { noon }, { WorldTime(653_712) }), { where }, { noon }, { WorldTime(653_712) })

    "the opening makes every bot, and each founds its house as its own player, named after its town, at its seat" {
        val world = RememberingWorld()
        val houses = RememberingHouses()

        bots(world, houses).open() shouldBe 2

        world.events.map { (it as WorldBotCreated).town } shouldBe listOf("Q84", "Q90")
        val london = houses.streams.getValue(HouseId.of(PlayerId.botAt("Q84"))).single() as HouseFounded
        london.player shouldBe PlayerId.botAt("Q84")
        london.name shouldBe HouseName("London")
        london.seat shouldBe Location(52.4, 2.0)
        houses.streams.keys shouldBe setOf(HouseId.of(PlayerId.botAt("Q84")), HouseId.of(PlayerId.botAt("Q90")))
    }

    "opening again makes nothing twice: no bot made again, no house founded again" {
        val world = RememberingWorld()
        val houses = RememberingHouses()
        bots(world, houses).open()
        val made = world.events.size

        bots(world, houses).open()

        world.events.size shouldBe made
        houses.streams.values.map { it.size } shouldBe listOf(1, 1)
    }

    "a bot keeps its banner, the same at every opening and on every tree" {
        val first = RememberingHouses().also { bots(RememberingWorld(), it).open() }
        val second = RememberingHouses().also { bots(RememberingWorld(), it).open() }

        fun bannerOf(houses: RememberingHouses) =
            (houses.streams.getValue(HouseId.of(PlayerId.botAt("Q84"))).single() as HouseFounded).banner

        bannerOf(first) shouldBe bannerOf(second)
    }

    "a bot made and stopped before it founded its house is founded at the next opening" {
        val world = RememberingWorld()
        val houses = RememberingHouses()
        bots(world, RememberingHouses()).open()

        bots(world, houses).open()

        houses.streams.size shouldBe 2
    }

    "with nowhere to stand, nothing is asked and nothing written" {
        val world = RememberingWorld()

        bots(world, RememberingHouses(), where = emptyList()).open() shouldBe 0
        world.events.shouldBeEmpty()
    }

    "the opening records the catalogues first, and without bots does only that" {
        val said = mutableListOf<String>()
        val world = RememberingWorld()

        Opening({ said += "catalogues" }, bots(world, RememberingHouses())).open() shouldBe 2
        Opening({ said += "catalogues again" }, null).open() shouldBe 0

        said shouldBe listOf("catalogues", "catalogues again")
        world.events.size shouldBe 2
    }
})
