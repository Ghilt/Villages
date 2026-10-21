package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import villages.domain.Resource
import villages.domain.SeenBy
import villages.domain.Stat
import villages.domain.StructureType
import villages.domain.Takes
import java.io.File

/**
 * The catalogue of structures as the server reads it: the shared fixture, which the world package's reader is held to
 * as well, and the real `world/catalogues/structures.json`, which has to read for the server to start. JUnit, as in the rest of
 * this module. See docs/plans/structures.md.
 */
class StructureCatalogueFileTest {
    private val fixture = File("../../contracts/fixtures/structures.json").readText()

    @Test
    fun `the shared fixture reads, every field the server keeps`() {
        val catalogue = StructureCatalogueFile.parse(fixture)
        assertEquals(listOf("castle", "watchtower"), catalogue.types.keys.map { it.name })

        val castle = catalogue.of(StructureType("castle"))!!
        assertEquals(2, castle.highest)
        assertEquals(24.0, castle.at(2).significance.value)
        assertEquals(40.0, castle.at(2).sightKm)
        assertEquals(mapOf(Resource.NATURAL_DOMAIN to 5.0, Resource.WEALTH to 2.0), castle.at(2).yieldsPerMonth)

        val (lord, cells) = castle.slots
        assertEquals(listOf("lord", Takes.CHARACTER, listOf(1, 1), SeenBy.ALL), listOf(lord.name, lord.takes, lord.places, lord.seenBy))
        assertTrue(lord.needed)
        assertEquals(Stat.PIETY, lord.scales)
        assertFalse(lord.bringsItsOwn)
        assertEquals(listOf(Takes.EITHER, listOf(2, 4), SeenBy.HOLDER), listOf(cells.takes, cells.places, cells.seenBy))
        assertEquals(mapOf(Resource.INFLUENCE to 1.0), cells.adds)
        assertTrue(cells.bringsItsOwn)
        assertFalse(cells.needed)

        val watchtower = catalogue.of(StructureType("watchtower"))!!
        assertEquals(1, watchtower.highest)
        assertEquals(emptyMap<Resource, Double>(), watchtower.at(1).yieldsPerMonth)
        assertEquals(emptyList<Any>(), watchtower.slots)
    }

    @Test
    fun `the world's own catalogue reads, nineteen types of three levels`() {
        val catalogue = StructureCatalogueFile.parse(File("../../world/catalogues/structures.json").readText())
        assertEquals(19, catalogue.types.size)
        assertTrue(catalogue.types.values.all { it.highest == 3 })
    }

    @Test
    fun `a field the server cannot read refuses the file, naming the type and the field`() {
        val broken = fixture.replace("\"sightKm\": [50]", "\"sightKm\": [\"far\"]")
        val refused = assertThrows<IllegalArgumentException> { StructureCatalogueFile.parse(broken) }
        assertEquals("world/catalogues/structures.json: watchtower has no sightKm the server can read", refused.message)
    }
}
