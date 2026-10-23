package villages.application.fate

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import io.kotest.matchers.types.shouldBeSameInstanceAs
import villages.application.CatalogueRefused
import villages.application.HouseRow
import villages.application.TEST_BALANCE
import villages.application.fate.FateCatalogue.ActionSpec
import villages.application.fate.FateCatalogue.Deals
import villages.application.fate.FateCatalogue.PoolSpec
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
import villages.domain.Stock
import villages.domain.Tincture
import villages.domain.WorldTime
import villages.domain.foundingStocks
import java.time.Instant
import java.util.UUID

/**
 * The fate catalogue, held to the rules that keep a hand always dealable - every action in Hearth, and three grants
 * at every rarity - and made into what the engine deals from: pools that open on their patterns, and actions that
 * deal what their kind names, a grant as much as the balance says. The real file is held by `FateFileTest`.
 */
class FateCatalogueSpec : StringSpec({
    val player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val founded = WorldTime(454901)
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val house = HouseRow(
        HouseId.of(player), player, HouseName("Ravenscar"), Location(61.0, 15.0), Significance(20.0),
        Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
        resources = foundingStocks(noon), pledges = emptyList(), since = founded, until = null, version = 1,
    )
    val bare = Moment(house, Looking.NOTHING, founded, noon, 25.0)

    fun grant(id: String, rarity: Rarity, vararg pools: String = arrayOf("Hearth", "Coin")) =
        ActionSpec(id, rarity, pools.toList(), "Collect $id", "Paid.", Deals.Grant(Resource.WEALTH))

    /** Three grants of every rarity in Hearth and Coin: the least that keeps a hand dealable. */
    val enough = Rarity.entries.flatMap { rarity -> (1..3).map { grant("${rarity.name.lowercase()}$it", rarity) } }
    val pools = listOf(PoolSpec("Hearth", emptyList()), PoolSpec("Coin", listOf("map.river", "window.river*")))

    fun omen(key: String) = Omen(OmenKey(key), OmenKind.MAP, key)

    "a catalogue that keeps a hand dealable is taken" {
        FateCatalogue(pools, enough).check()
    }

    "with no Hearth, an action out of it, a pool not there, or too few grants of a rarity, it is refused" {
        val missing = { fate: FateCatalogue -> shouldThrow<CatalogueRefused> { fate.check() }.message }

        missing(FateCatalogue(pools.drop(1), enough)) shouldBe "world/catalogues/fate.json: pools have Hearth, which is always open"
        missing(FateCatalogue(pools, enough + grant("lost", Rarity.RARE, "Coin"))) shouldBe
            "world/catalogues/fate.json: actions.lost.pools have Hearth"
        missing(FateCatalogue(pools, enough + grant("far", Rarity.RARE, "Hearth", "Sea"))) shouldBe
            "world/catalogues/fate.json: actions.far.pools name pools there are, not Sea"
        missing(FateCatalogue(pools, enough.drop(1))) shouldBe
            "world/catalogues/fate.json: actions have at least 3 grants that are common, not 2"
        missing(FateCatalogue(pools, enough + enough.first())) shouldBe "world/catalogues/fate.json: actions have an id each"
    }

    "a pool opens on a key exactly, or on every key beginning with what comes before its star" {
        val coin = Pool("Coin", listOf("map.river", "window.river*"))

        listOf("map.river", "window.river", "window.river:Q548", "map.rivers", "window.lake").map { coin.opensOn(omen(it)) } shouldBe
            listOf(true, true, true, false, false)
    }

    "an action deals what its kind names: a grant, as much as the balance says its rarity grants" {
        val content = FateFromCatalogue({ FateCatalogue(pools, enough) }, { _, _, _ -> emptyList() }, { UUID.randomUUID() }) { TEST_BALANCE }()
        val rare = content.actions.first { it.rarity == Rarity.RARE }

        rare.pools.map { it.name }.toSet() shouldBe setOf("Hearth", "Coin")
        rare.deal(bare, emptyList())!!.effect.shouldBeInstanceOf<Effect.Grant>().amount shouldBe 120
        content.pools.first() shouldBeSameInstanceAs Pool.HEARTH
    }

    "the content is made again only when the catalogue changes" {
        var catalogue = FateCatalogue(pools, enough)
        val made = FateFromCatalogue({ catalogue }, { _, _, _ -> emptyList() }, { UUID.randomUUID() }) { TEST_BALANCE }

        made() shouldBeSameInstanceAs made()
        val before = made()
        catalogue = FateCatalogue(pools, enough.reversed())
        (made() === before) shouldBe false
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
})
