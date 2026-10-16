package villages.application.fate

import villages.application.TEST_BALANCE
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.application.Dice
import villages.application.HouseRow
import villages.application.HousesByPlayer
import villages.application.Provenance
import villages.application.TinyWorld
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.Effect
import villages.domain.FOUNDING_WEALTH
import villages.domain.FoundHouse
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.PlayerRolled
import villages.domain.Rarity
import villages.domain.Resource
import villages.domain.Significance
import villages.domain.Tincture
import villages.domain.WorldTime
import villages.domain.foundingStocks
import java.time.Instant
import java.util.UUID

/** Pressing Take action: the engine rolls, and one `Roll` records the roll, its price and its hand. */
class RollServiceSpec : StringSpec({
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val today = WorldTime(454901)
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT)
    val seat = Location(59.33, 18.07)
    val row = HouseRow(
        HouseId.of(ada), ada, HouseName("Ravenscar"), seat, Significance(20.0), banner,
        resources = foundingStocks(noon), pledges = emptyList(), since = today, until = null, version = 1,
    )

    fun rig(): Pair<TinyWorld, RollService> {
        val world = TinyWorld()
        world.execute(FoundHouse(HouseId.of(ada), ada, HouseName("Ravenscar"), seat, banner, today, noon), Provenance.startedBy(UUID.randomUUID()))
        val actions = listOf(Rarity.COMMON, Rarity.RARE).flatMap { rarity ->
            (1..3).map { n -> Action("$rarity$n", rarity, setOf(Pool.HEARTH)) { _, _ -> Dealt("$rarity$n", "", Effect.Grant(Resource.WEALTH, 15)) } }
        }
        val engine = FateEngine(emptyList(), listOf(Pool.HEARTH), actions, Dice { 1 }, { UUID.randomUUID() }) { TEST_BALANCE }
        val houses = HousesByPlayer { player -> row.takeIf { player == ada } }
        return world to RollService(engine, houses, world, { noon }, { today }, { UUID.randomUUID() }) { TEST_BALANCE }
    }

    "a roll is paid for, and leaves its hand pending" {
        val (world, rolls) = rig()

        val rolled = rolls.roll(ada, Looking.NOTHING, Provenance.startedBy(UUID.randomUUID()))

        world.stored.map { it.event }.filterIsInstance<PlayerRolled>().single().rarity shouldBe Rarity.COMMON
        val house = world.founded(HouseId.of(ada))
        house.stockOf(Resource.WEALTH).at(noon) shouldBe FOUNDING_WEALTH - TEST_BALANCE.roll.price
        house.pending shouldBe rolled.hand
    }

    "a second roll before the first is answered is refused" {
        val (_, rolls) = rig()
        rolls.roll(ada, Looking.NOTHING, Provenance.startedBy(UUID.randomUUID()))

        shouldThrow<HouseError.ChoicePending> { rolls.roll(ada, Looking.NOTHING, Provenance.startedBy(UUID.randomUUID())) }
    }

    "a player with no house is refused before anything rolls" {
        val (world, rolls) = rig()
        val stranger = PlayerId(UUID.randomUUID())
        val before = world.commands

        shouldThrow<HouseError.NoSuchHouse> { rolls.roll(stranger, Looking.NOTHING, Provenance.startedBy(UUID.randomUUID())) }
        world.commands shouldBe before
    }

    "the lever's rarity stands in for the throw, once" {
        val (world, rolls) = rig()

        val heard = mutableListOf<Boolean>()
        rolls.watch { _, _, forced -> heard += forced }
        rolls.forceNext(ada, Rarity.RARE)

        rolls.roll(ada, Looking.NOTHING, Provenance.startedBy(UUID.randomUUID()))

        world.stored.map { it.event }.filterIsInstance<PlayerRolled>().single().rarity shouldBe Rarity.RARE
        world.founded(HouseId.of(ada)).pending!!.options.map { it.rarity }.toSet() shouldBe setOf(Rarity.RARE)
        heard shouldBe listOf(true)
    }
})
