package villages.application

import villages.application.fate.FateCatalogue
import villages.domain.StructureCatalogue
import villages.domain.TakeOnCatalogue
import villages.domain.isCatalogueName
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.CopyOnWriteArraySet

/**
 * The catalogue files as the game server reads them, from `world/catalogues/`: a port, its adapter in `app`. Each by
 * its name on the shelf - its path under the folder without `.json`, `structures` or `dialogues/letter` - as text.
 * See decision record 0097.
 */
interface CatalogueFiles {
    fun read(): Map<String, String>

    /** Writes one catalogue whole and at once, so nothing reading the folder ever sees half of it. */
    fun write(catalogue: String, text: String)
}

/** A catalogue revision the game server will not write, because the file on disk is not the one the page read. */
class CatalogueStale(val catalogue: String) :
    RuntimeException("world/catalogues/$catalogue.json has changed on disk since it was read: read it again")

/** A revision asked of a server that takes none: a released one, `villages.catalogues.editable=false`. */
class CataloguesReadOnly : RuntimeException("this server takes no revisions of its catalogues")

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
    /** The file's one form, which every revision is written in: two spaces, and one line wherever it fits. */
    private val format: (String) -> String = { it },
    /** Whether it takes revisions and looks at the folder: on, unless a released server turns it off. */
    val editable: Boolean = true,
) {
    private val listeners = CopyOnWriteArraySet<(Map<String, String>) -> Unit>()
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

    /** The balance in force, at the moment of asking. */
    val balance: Balance get() = inForce.balance

    /** The pools and the actions in force, at the moment of asking. */
    val fate: FateCatalogue get() = inForce.fate

    /** What a newcomer can be called, at the moment of asking. */
    val characterNames: CharacterNames get() = inForce.characterNames

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

    /**
     * Saves [text] as [catalogue] and takes it on, in one act, and answers with the fingerprint of what it wrote. The
     * text is written in the file's one form, so a number changed is a diff of one line. Refused, and nothing
     * written: [CatalogueStale] when the file on disk is not the one [basedOn] names - a hand edit made in between is
     * never written over, and a new catalogue is based on nothing, `""` - [CatalogueRefused] for one the server will
     * not take on, and [CataloguesReadOnly] on a server that takes no revisions.
     */
    @Synchronized
    fun revise(catalogue: String, text: String, basedOn: String): String {
        if (!editable) throw CataloguesReadOnly()
        if (!isCatalogueName(catalogue)) throw CatalogueRefused(catalogue, "not a name on the shelf")
        val now = files.read()
        if ((now[catalogue]?.let(::fingerprintOf) ?: "") != basedOn) throw CatalogueStale(catalogue)
        val written = try {
            format(text)
        } catch (@Suppress("TooGenericExceptionCaught") unreadable: RuntimeException) {
            throw CatalogueRefused(catalogue, unreadable.message ?: "it is not JSON")
        }
        val candidate = now + (catalogue to written)
        val read = reader.read(candidate)
        files.write(catalogue, written)
        lastRead = candidate
        swapAndRecord(candidate, read)
        return fingerprintOf(written)
    }

    /** Hears the fingerprints of what is in force whenever the shelf takes something on, until the handle is closed. */
    fun watch(listener: (Map<String, String>) -> Unit): AutoCloseable {
        listeners += listener
        return AutoCloseable { listeners -= listener }
    }

    private fun takeOn(now: Map<String, String>): Set<String> {
        val read = try {
            reader.read(now)
        } catch (refused: CatalogueRefused) {
            lastRefused = now
            faults.report(Fault("the shelf", "world/catalogues/${refused.catalogue}.json", refused))
            return emptySet()
        }
        return swapAndRecord(now, read)
    }

    /** Swaps in [read], made of [now], records what changed, and tells the listeners; a record that fails is taken back. */
    private fun swapAndRecord(now: Map<String, String>, read: Catalogues): Set<String> {
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
        val fingerprints = fingerprints()
        listeners.forEach { it(fingerprints) }
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
