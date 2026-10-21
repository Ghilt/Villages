package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import villages.application.bots.RuinReach
import villages.domain.Location
import kotlin.math.cos
import kotlin.math.sqrt

/** `world/ruins.json` as the server reads it, for how far each town's ruins reach. See decision record 0108. */
class RuinsFileTest {
    private val real = RuinsFile.parse(java.io.File("../../world/ruins.json").readText())

    @Test
    fun `London's ruins reach by the root of its people, narrowed to its latitude`() {
        val london = Location(51.5, -0.1)
        val expected = 1.25 * sqrt(860.0) * 1.3 * RuinReach.KM_A_UNIT * cos(Math.toRadians(51.5))

        assertEquals(expected, real.kmOf("Q84", london), 1e-6)
    }

    @Test
    fun `a town the file does not list reaches as its unlisted people do`() {
        assertEquals(5 * 1.3 * RuinReach.KM_A_UNIT, real.kmOf("not a town", Location(0.0, 0.0)), 1e-6)
    }

    @Test
    fun `a number it cannot read refuses the file, naming where`() {
        val broken = """{ "size": { "perRootThousand": "many" }, "towns": {} }"""

        val refused = assertThrows<IllegalArgumentException> { RuinsFile.parse(broken) }
        assertEquals("world/ruins.json: no size.perRootThousand the server can read", refused.message)
    }
}
