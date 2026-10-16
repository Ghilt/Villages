package villages.application.fate

import villages.application.TEST_BALANCE
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.ints.shouldBeGreaterThanOrEqual
import io.kotest.matchers.shouldBe
import villages.application.HouseRow
import villages.domain.Banner
import villages.domain.CharacterId
import villages.domain.Charge
import villages.domain.Division
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.Omen
import villages.domain.OmenKind
import villages.domain.PlayerId
import villages.domain.Rarity
import villages.domain.Resource
import villages.domain.Significance
import villages.domain.Stock
import villages.domain.Tincture
import villages.domain.WorldTime
import villages.domain.foundingStocks
import java.time.Instant
import java.util.UUID

/**
 * The content the fate engine deals from, held to the two rules that keep a hand always dealable: every action is in
 * Hearth and in a pool of its own, and every rarity has at least three actions that can be dealt with no omens at all.
 * Every action deals from a bare moment with nothing open, which is the house a roll can always be made for.
 */
class FirstContentSpec : StringSpec({
    val player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val founded = WorldTime(454901)
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val house = HouseRow(
        HouseId.of(player), player, HouseName("Ravenscar"), Location(61.0, 15.0), Significance(20.0),
        Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
        resources = foundingStocks(noon), pledges = emptyList(), since = founded, until = null, version = 1,
    )
    val resourceActions = ResourceActions.all { TEST_BALANCE.roll.grants }
    val bare = Moment(house, Looking.NOTHING, founded, noon)

    "every action is in Hearth and in at least one pool besides" {
        for (action in resourceActions) {
            withClue(action.id) {
                action.pools shouldContain Pool.HEARTH
                (action.pools - Pool.HEARTH).size shouldBeGreaterThanOrEqual 1
                FirstPools.ALL.containsAll(action.pools) shouldBe true
            }
        }
    }

    "every rarity has at least three actions in Hearth that can be dealt with no omens" {
        for (rarity in Rarity.entries) {
            withClue(rarity) {
                resourceActions.count { it.rarity == rarity && Pool.HEARTH in it.pools && it.deal(bare, emptyList()) != null } shouldBeGreaterThanOrEqual 3
            }
        }
    }

    "one action of each rarity gives each resource, as much as its rarity says" {
        resourceActions shouldHaveSize Resource.entries.size * Rarity.entries.size
        resourceActions.map { it.id }.toSet() shouldHaveSize resourceActions.size
    }

    "a newly founded house reads its holdings and is a weak house; a pious one is pious" {
        HouseOmens { TEST_BALANCE }.read(bare).map { it.words } shouldBe listOf("Holdings in the northern reaches", "Weak house")

        val older = bare.copy(today = WorldTime(founded.day + TEST_BALANCE.omens.weakForDays))
        val pious = older.copy(house = house.withStock(Resource.PIETY) { Stock(104, 0.0, noon) })
        val read = HouseOmens { TEST_BALANCE }.read(pious)

        read.map { it.words } shouldBe listOf("Holdings in the northern reaches", "Pious")
        read.last().value shouldBe 104
        read.map { it.kind }.toSet() shouldBe setOf(OmenKind.HOUSE)
    }

    "the omens a house reads open the pools they should" {
        val read = HouseOmens { TEST_BALANCE }.read(bare.copy(house = house.withStock(Resource.PIETY) { Stock(100, 0.0, noon) }))

        FirstPools.ALL.filter { pool -> read.any(pool::opensOn) }.map { it.name } shouldBe listOf("Coin", "Land", "Faith")
    }

    "a window open on water opens the coin, whatever the water and whether or not anybody has named it" {
        val windows = listOf(
            WaterHere(WaterKind.RIVER, "Q548", "Vistula"),
            WaterHere(WaterKind.LAKE, "ground:188,43"),
            WaterHere(WaterKind.SEA, "Q1693", "German Ocean"),
        ).map { Omen(OmenKeys.inspectingWater(it), OmenKind.WINDOW, "Inspecting ${it.called}") }

        windows.map { it.key.value } shouldBe listOf("window.river:Q548", "window.lake", "window.sea:Q1693")
        windows.map { it.words } shouldBe listOf("Inspecting the Vistula", "Inspecting a lake", "Inspecting the German Ocean")
        windows.map { omen -> FirstPools.ALL.filter { it.opensOn(omen) }.map { it.name } }.toSet() shouldBe setOf(listOf("Coin"))
        FirstPools.COIN.opensOn(Omen(OmenKeys.inspectingCharacter(CharacterId(UUID.randomUUID())), OmenKind.WINDOW, "")) shouldBe false
    }
})
