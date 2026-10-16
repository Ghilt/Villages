package villages.application

import villages.domain.TakeOnCatalogue
import java.security.MessageDigest
import java.util.UUID

/**
 * The catalogue files as the game server reads them, from `world/catalogues/`: a port, its adapter in `app`. Each by
 * its name on the shelf - its path under the folder without `.json`, `structures` or `dialogues/letter` - as text.
 * See decision record 0097.
 */
fun interface CatalogueFiles {
    fun read(): Map<String, String>
}

/**
 * The game server's shelf of catalogues: what it reads the game's content from, and what records, on the world's own
 * stream, every version of a catalogue it takes on. A version already recorded writes nothing, so a server started
 * again on the same files is silent and a fresh world's history opens with one `catalogueChanged` for each catalogue.
 * After a wipe it records them all again, because a world with no record of what it runs on would break the rule
 * that every catalogue in force is recorded. See decision record 0097.
 */
class Shelf(
    private val files: CatalogueFiles,
    private val world: WorldCommandExecutor,
    private val clock: Clock,
    private val worldClock: WorldClock,
) {
    /**
     * Takes on every catalogue on the shelf, in one story, and says how many there are. A version the world has
     * recorded already writes nothing.
     */
    fun recordAll(): Int {
        val story = UUID.randomUUID()
        val shelved = files.read().toSortedMap()
        for ((catalogue, text) in shelved) {
            world.execute(
                TakeOnCatalogue(catalogue, text, fingerprintOf(text), worldClock.today(), clock.now()),
                Provenance(commandId = UUID.randomUUID(), correlationId = story),
            )
        }
        return shelved.size
    }

    companion object {
        /** The SHA-256 of a catalogue's text as UTF-8, its bytes on disk, in hex: what the dev server sends the page. */
        fun fingerprintOf(text: String): String =
            MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }
}
