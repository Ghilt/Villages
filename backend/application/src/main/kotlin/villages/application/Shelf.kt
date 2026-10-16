package villages.application

import villages.domain.StructureCatalogue
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
 * The game server's shelf of catalogues: what it reads the game's content from, held in force, and what records on
 * the world's own stream every version of a catalogue it takes on. See decision record 0097.
 *
 * **It takes a catalogue on only once every check has passed**: the reader's, of each file's shape and the domain's
 * own rules, and [Catalogues.check], between them. A shelf it cannot read as the server starts stops the server, saying
 * which file and why; one that fails while it runs is refused, said as a fault in the log and the debug panel, and
 * the catalogues in force go on.
 *
 * **It swaps and then records**, so whatever hears the record - the standing-effects listener setting every income
 * right - reads the new catalogue. A record that fails takes the swap back. A version the world recorded already
 * writes nothing, so a restart over the same files is silent; after a wipe it records again what is in force.
 *
 * **A change is taken when the files have held still**: [refresh] is asked again and again, and acts on what it reads
 * only when it read the same the time before, so an editor's save in several writes is taken once, whole.
 */
class Shelf(
    private val files: CatalogueFiles,
    private val reader: CatalogueReader,
    private val world: WorldCommandExecutor,
    private val clock: Clock,
    private val worldClock: WorldClock,
    private val faults: Faults,
) {
    @Volatile
    private var held: Catalogues? = null

    /** The text of each catalogue in force, by its name: what the world last recorded of it. */
    @Volatile
    private var texts: Map<String, String> = emptyMap()

    /** What the files said at the last [refresh], to know when they have held still. */
    private var lastRead: Map<String, String>? = null

    /** What was last refused, so a file left broken is said once rather than at every look. */
    private var lastRefused: Map<String, String>? = null

    /** Every catalogue in force. */
    val inForce: Catalogues get() = held ?: error("the shelf has not been read yet")

    /** The structures' catalogue in force, at the moment of asking. */
    val structures: StructureCatalogue get() = inForce.structures

    /** The fingerprint of each catalogue in force, by its name. */
    fun fingerprints(): Map<String, String> = texts.mapValues { (_, text) -> fingerprintOf(text) }

    /** Reads every catalogue and takes them on; throws [CatalogueRefused] for a shelf the server cannot start on. */
    @Synchronized
    fun start() {
        val read = files.read()
        held = reader.read(read)
        texts = read
        lastRead = read
        record(read.keys, read)
    }

    /** Records again every catalogue in force, after a wipe has emptied the world of its record. */
    @Synchronized
    fun recordAll(): Int {
        record(texts.keys, texts)
        return texts.size
    }

    /**
     * Looks at the files again and takes on whatever changed, once they have held still: the names of the catalogues
     * it took on, none when nothing changed, the files are still moving, or what changed was refused.
     */
    @Synchronized
    fun refresh(): Set<String> {
        val now = files.read()
        val settled = now == lastRead
        lastRead = now
        if (!settled || now == texts || now == lastRefused) {
            return emptySet()
        }
        return takeOn(now)
    }

    private fun takeOn(now: Map<String, String>): Set<String> {
        val read = try {
            reader.read(now)
        } catch (refused: CatalogueRefused) {
            lastRefused = now
            faults.report(Fault("the shelf", "world/catalogues/${refused.catalogue}.json", refused))
            return emptySet()
        }
        val changed = now.filter { (name, text) -> texts[name] != text }.keys
        val was = held to texts
        held = read
        texts = now
        try {
            record(changed, now)
        } catch (@Suppress("TooGenericExceptionCaught") unrecorded: RuntimeException) {
            held = was.first
            texts = was.second
            throw unrecorded
        }
        return changed
    }

    /** Takes on [names] of [shelved] on the world's own stream, in one story. */
    private fun record(names: Set<String>, shelved: Map<String, String>) {
        val story = UUID.randomUUID()
        for (catalogue in names.sorted()) {
            val text = shelved.getValue(catalogue)
            world.execute(
                TakeOnCatalogue(catalogue, text, fingerprintOf(text), worldClock.today(), clock.now()),
                Provenance(commandId = UUID.randomUUID(), correlationId = story),
            )
        }
    }

    companion object {
        /** The SHA-256 of a catalogue's text as UTF-8, its bytes on disk, in hex: what the dev server sends the page. */
        fun fingerprintOf(text: String): String =
            MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }
}
