package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import villages.application.fate.FateCatalogue.Deals
import villages.application.fate.FateFromCatalogue
import villages.application.fate.OmenKeys
import villages.application.fate.WaterHere
import villages.application.fate.WaterKind
import villages.domain.Omen
import villages.domain.OmenKind
import villages.domain.Rarity
import villages.domain.Resource
import java.io.File
import java.util.UUID

/** The pools and actions as the server reads them, held to the fixture the world package's reader is held to. */
class FateFileTest {
    private val fixture = File("../../contracts/fixtures/fate.json").readText()
    private val real = File("../../world/catalogues/fate.json").readText()

    @Test
    fun `the fixture reads as it says`() {
        val fate = FateFile.parse(fixture)

        assertEquals(listOf("Hearth", "Coin"), fate.pools.map { it.name })
        assertEquals(listOf("map.river", "window.river*"), fate.pools[1].opensOn)
        assertEquals(listOf("wealth.common", "piety.rare", "gossip.common"), fate.actions.map { it.id })
        assertEquals(Deals.Grant(Resource.PIETY), fate.actions[1].deals)
        assertEquals(Rarity.RARE, fate.actions[1].rarity)
        assertEquals(Deals.Gossip(7, 900.0, listOf("keeps a horse it cannot afford", "has quarrelled with its priest")), fate.actions[2].deals)
        assertEquals("Gossip about {house}", fate.actions[2].label)
    }

    @Test
    fun `the real one reads, keeps a hand dealable, and is in the one form`() {
        FateFile.parse(real).check()
        assertEquals(real, CatalogueText.format(real))
    }

    @Test
    fun `a window open on water opens the coin, whatever the water and whether or not anybody has named it`() {
        val pools = FateFromCatalogue({ FateFile.parse(real) }, { _, _, _ -> emptyList() }, { UUID.randomUUID() }) {
            error("no balance is asked of opening a pool")
        }().pools
        val windows = listOf(
            WaterHere(WaterKind.RIVER, "Q548", "Vistula"),
            WaterHere(WaterKind.LAKE, "ground:188,43"),
            WaterHere(WaterKind.SEA, "Q1693", "German Ocean"),
        ).map { Omen(OmenKeys.inspectingWater(it), OmenKind.WINDOW, "Inspecting ${it.called}") }

        assertEquals(setOf(listOf("Coin")), windows.map { omen -> pools.filter { it.opensOn(omen) }.map { it.name } }.toSet())
        assertEquals(
            listOf("Coin", "Land", "Faith"),
            pools.filter { pool -> listOf(OmenKeys.WEAK, OmenKeys.holdings("the north"), OmenKeys.PIOUS).any { pool.opensOn(Omen(it, OmenKind.HOUSE, "")) } }
                .map { it.name },
        )
    }

    @Test
    fun `an action that is neither a grant nor gossip, or both, is refused, naming it`() {
        val both = fixture.replace("\"grants\": \"wealth\"", "\"grants\": \"wealth\", \"gossip\": {}")

        assertEquals(
            "world/catalogues/fate.json: no actions.wealth.common.grants or gossip, and only one, the server can read",
            assertThrows<IllegalArgumentException> { FateFile.parse(both) }.message,
        )
    }
}
