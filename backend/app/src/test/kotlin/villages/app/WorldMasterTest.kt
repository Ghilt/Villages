package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.io.File

/** The world's master as the server names it is the one the page draws unless told otherwise. */
class WorldMasterTest {
    @Test
    fun `the server's world master is the page's default`() {
        val masters = File("../../frontend/packages/world/src/masters.ts").readText()
        val pages = Regex("""export const DEFAULT_MASTER = '([^']+)';""").find(masters)?.groupValues?.get(1)
        assertEquals(pages, WORLD_MASTER)
    }
}
