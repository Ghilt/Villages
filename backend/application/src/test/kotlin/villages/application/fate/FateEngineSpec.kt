package villages.application.fate

import villages.application.TEST_BALANCE
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import villages.application.Dice
import villages.application.FreshIds
import villages.application.HouseRow
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.Effect
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.Omen
import villages.domain.OmenKey
import villages.domain.OmenKind
import villages.domain.PlayerId
import villages.domain.Rarity
import villages.domain.Resource
import villages.domain.Significance
import villages.domain.Tincture
import villages.domain.WorldTime
import villages.domain.foundingStocks
import java.time.Instant
import java.util.UUID
import kotlin.random.Random

/**
 * The fate engine's luck, held still: the odds, a hand of one rarity, the weights the omens give, and the marks an
 * option carries. With toy content, so that the rules are tested apart from the words. See decision record 0083.
 */
class FateEngineSpec : StringSpec({
    val player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val today = WorldTime(454901)
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val house = HouseRow(
        HouseId.of(player), player, HouseName("Ravenscar"), Location(59.33, 18.07), Significance(20.0),
        Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
        resources = foundingStocks(noon), pledges = emptyList(), since = today, until = null, version = 1,
    )
    val moment = Moment(house, Looking.NOTHING, today, noon, 25.0)

    val river = Omen(OmenKey("map.river"), OmenKind.MAP, "River")
    val pious = Omen(OmenKey("house.pious"), OmenKind.HOUSE, "Pious", 104)
    val water = Pool("Water", listOf(river.key.value))
    val faith = Pool("Faith", listOf(pious.key.value))

    fun action(id: String, rarity: Rarity = Rarity.COMMON, vararg pools: Pool, dealable: Boolean = true) =
        Action(id, rarity, setOf(Pool.HEARTH, *pools)) { _, _ ->
            Dealt(id, "", Effect.Grant(Resource.WEALTH, 15)).takeIf { dealable }
        }

    val ids = FreshIds { UUID.randomUUID() }

    fun engine(actions: List<Action>, omens: List<Omen> = emptyList(), dice: Dice = Dice { 1 }) =
        FateEngine(listOf(OmenSource { omens }), listOf(Pool.HEARTH, water, faith), actions, dice, ids) { TEST_BALANCE }

    val commons = listOf(action("a"), action("b"), action("c"), action("d"))

    "the odds run seventy, twenty-two, seven and one, in a throw of a hundred" {
        TEST_BALANCE.roll.odds.values.sum() shouldBe 100
        listOf(1, 70, 71, 92, 93, 99, 100).map { FateEngine.rarityFrom(it, TEST_BALANCE.roll.odds) } shouldBe listOf(
            Rarity.COMMON, Rarity.COMMON, Rarity.UNCOMMON, Rarity.UNCOMMON, Rarity.RARE, Rarity.RARE, Rarity.LEGENDARY,
        )
    }

    "a hand is three options, every one of the rarity rolled" {
        val rares = listOf(action("r1", Rarity.RARE), action("r2", Rarity.RARE), action("r3", Rarity.RARE))
        val rolled = engine(commons + rares).roll(moment, Rarity.RARE)

        rolled.rarity shouldBe Rarity.RARE
        rolled.hand.options shouldHaveSize 3
        rolled.hand.options.map { it.rarity }.toSet() shouldBe setOf(Rarity.RARE)
        rolled.hand.options.map { it.label }.toSet() shouldBe setOf("r1", "r2", "r3")
    }

    "the throw decides the rarity when nothing stands in for it" {
        val rares = listOf(action("r1", Rarity.RARE), action("r2", Rarity.RARE), action("r3", Rarity.RARE))

        engine(commons + rares, dice = Dice { sides -> if (sides == 100) 95 else 1 }).roll(moment).rarity shouldBe Rarity.RARE
    }

    "a rarity with too little that can be dealt falls to the one below, so a hand is still one rarity" {
        val lonely = listOf(action("l1", Rarity.LEGENDARY))

        val rolled = engine(commons + lonely).roll(moment, Rarity.LEGENDARY)

        rolled.rarity shouldBe Rarity.COMMON
        rolled.hand.options.map { it.rarity }.toSet() shouldBe setOf(Rarity.COMMON)
    }

    "an action that cannot be dealt now is not drawn" {
        val rolled = engine(listOf(action("a"), action("b"), action("c"), action("x", dealable = false))).roll(moment)

        rolled.considered.map { it.action } shouldContainExactly listOf("a", "b", "c")
    }

    "only the pools an omen opens are open, and Hearth always" {
        engine(commons, listOf(river)).roll(moment).opened shouldBe listOf("Hearth", "Water")
        engine(commons).roll(moment).opened shouldBe listOf("Hearth")
    }

    "an option carries the omens that opened its pools, and an action only in Hearth carries none" {
        val rolled = engine(
            listOf(action("w", Rarity.COMMON, water), action("f", Rarity.COMMON, faith), action("h")),
            listOf(river, pious),
        ).roll(moment)

        rolled.hand.options.associate { it.label to it.omens } shouldBe mapOf(
            "w" to listOf(river.key),
            "f" to listOf(pious.key),
            "h" to emptyList(),
        )
        rolled.omens shouldBe listOf(river, pious)
    }

    "an action in two open pools is drawn about twice as often as one in one" {
        val random = Random(20261004)
        val actions = listOf(action("twice", Rarity.COMMON, water)) + (1..20).map { action("once$it") }
        val engine = engine(actions, listOf(river), Dice { sides -> random.nextInt(sides) + 1 })

        val rolls = 4000
        val heavy = (1..rolls).count { engine.roll(moment).hand.options.first().label == "twice" }

        // Twenty-one in the draw: one of weight two, twenty of weight one, so the first pick is it 2/22 of the time.
        heavy.toDouble() / rolls shouldBe (2.0 / 22).plusOrMinus(0.015)
    }

    "two omens of one key are read once" {
        engine(commons, listOf(river, river.copy(words = "A river"))).roll(moment).omens shouldBe listOf(river)
    }

    "nothing is drawn twice in one hand" {
        val rolled = engine(commons, dice = Dice { sides -> sides }).roll(moment)

        rolled.hand.options.map { it.label }.toSet() shouldHaveSize 3
        rolled.hand.options.filter { it.omens.isNotEmpty() }.shouldBeEmpty()
    }
})
