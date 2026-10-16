package villages.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import villages.domain.LevelSpec
import villages.domain.Significance
import villages.domain.StructureCatalogue
import villages.domain.StructureSpec
import villages.domain.StructureType
import villages.domain.TakeOnCatalogue
import villages.domain.WorldCommand
import villages.domain.WorldTime
import java.time.Instant

class ShelfSpec : StringSpec({

    val noon = Instant.parse("2026-10-16T12:00:00Z")

    /** A world stream that keeps what it is asked to take on, and the story each was asked in. */
    class Taken : WorldCommandExecutor {
        val commands = mutableListOf<Pair<TakeOnCatalogue, Provenance>>()
        var refusing = false

        override fun execute(command: WorldCommand, provenance: Provenance) {
            check(!refusing) { "the store is away" }
            commands += (command as TakeOnCatalogue) to provenance
        }
    }

    /** The folder, as a map the test changes. */
    class Folder(var files: Map<String, String>) : CatalogueFiles {
        val written = mutableListOf<String>()

        override fun read() = files

        override fun write(catalogue: String, text: String) {
            files = files + (catalogue to text)
            written += catalogue
        }
    }

    /** A reader that reads a structures' file as one type named by its text, and refuses a text that says so. */
    val reader = CatalogueReader { files ->
        val text = files[Catalogues.STRUCTURES] ?: throw CatalogueRefused(Catalogues.STRUCTURES, "it is not on the shelf")
        if ("broken" in text) throw CatalogueRefused(Catalogues.STRUCTURES, "castle has no sightKm the server can read")
        Catalogues(StructureCatalogue(mapOf(StructureType(text.trim()) to StructureSpec(listOf(LevelSpec(Significance(10.0), 6.0, emptyMap())), emptyList()))), TEST_BALANCE)
    }

    class Rig(files: Map<String, String>, editable: Boolean = true) {
        val folder = Folder(files)
        val taken = Taken()
        val faults = mutableListOf<Fault>()
        val shelf = Shelf(folder, reader, taken, { noon }, { WorldTime(653_712) }, object : Faults {
            override fun report(fault: Fault) {
                faults += fault
            }

            override fun watch(listener: (Fault) -> Unit) = AutoCloseable {}
        }, format = { it.trim() + "\n" }, editable = editable)

        /** Looks twice, as the watch does, so the files have held still. */
        fun look(): Set<String> = shelf.refresh().ifEmpty { shelf.refresh() }
    }

    "every catalogue on the shelf is taken on as it starts, by name, text and the fingerprint of its bytes, in one story" {
        val rig = Rig(mapOf("structures" to "castle\n", "dialogues/letter" to "{ \"é\": 1 }\n"))
        rig.shelf.start()

        rig.taken.commands.map { it.first.catalogue } shouldContainExactly listOf("dialogues/letter", "structures")
        rig.taken.commands.map { it.second.correlationId }.toSet().size shouldBe 1
        rig.taken.commands.first().first.worldTime shouldBe WorldTime(653_712)
        rig.shelf.structures.types.keys shouldBe setOf(StructureType("castle"))
    }

    "a shelf it cannot read stops the server starting, naming the file" {
        val rig = Rig(mapOf("structures" to "broken"))

        shouldThrow<CatalogueRefused> { rig.shelf.start() }.message shouldBe
            "world/catalogues/structures.json: castle has no sightKm the server can read"
    }

    "a file changed while it runs is taken on once it has held still, and only what changed is recorded" {
        val rig = Rig(mapOf("structures" to "castle\n", "dialogues/letter" to "{}\n"))
        rig.shelf.start()
        rig.taken.commands.clear()

        rig.folder.files = mapOf("structures" to "fort\n", "dialogues/letter" to "{}\n")
        rig.shelf.refresh().shouldBeEmpty()

        rig.shelf.refresh() shouldBe setOf("structures")
        rig.taken.commands.map { it.first.catalogue } shouldContainExactly listOf("structures")
        rig.shelf.structures.types.keys shouldBe setOf(StructureType("fort"))
        rig.look().shouldBeEmpty()
    }

    "a file broken while it runs is refused once, said as a fault, and the catalogue in force goes on" {
        val rig = Rig(mapOf("structures" to "castle\n"))
        rig.shelf.start()
        rig.taken.commands.clear()

        rig.folder.files = mapOf("structures" to "broken\n")
        rig.look().shouldBeEmpty()
        rig.look().shouldBeEmpty()

        rig.faults.map { it.describe() } shouldContainExactly
            listOf("the shelf threw on world/catalogues/structures.json: CatalogueRefused: world/catalogues/structures.json: castle has no sightKm the server can read")
        rig.taken.commands.shouldBeEmpty()
        rig.shelf.structures.types.keys shouldBe setOf(StructureType("castle"))

        rig.folder.files = mapOf("structures" to "fort\n")
        rig.look() shouldBe setOf("structures")
    }

    "a change the world cannot record is taken back" {
        val rig = Rig(mapOf("structures" to "castle\n"))
        rig.shelf.start()
        rig.taken.refusing = true

        rig.folder.files = mapOf("structures" to "fort\n")
        rig.shelf.refresh()
        shouldThrow<IllegalStateException> { rig.shelf.refresh() }.message shouldContain "away"

        rig.shelf.structures.types.keys shouldBe setOf(StructureType("castle"))
    }

    "after a wipe, what is in force is recorded again" {
        val rig = Rig(mapOf("structures" to "castle\n"))
        rig.shelf.start()

        rig.shelf.recordAll() shouldBe 1

        rig.taken.commands.map { it.first.catalogue } shouldContainExactly listOf("structures", "structures")
    }

    "a fingerprint is the SHA-256 of the file's bytes, as the dev server works it out" {
        // `printf '{}\n' | sha256sum`
        Shelf.fingerprintOf("{}\n") shouldBe "ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356"
    }
    "a revision is written in the one form, taken on, recorded and told, and its fingerprint is the answer" {
        val rig = Rig(mapOf("structures" to "castle\n"))
        rig.shelf.start()
        rig.taken.commands.clear()
        val told = mutableListOf<Map<String, String>>()
        rig.shelf.watch { told += it }

        val fingerprint = rig.shelf.revise("structures", "  fort  ", Shelf.fingerprintOf("castle\n"))

        rig.folder.files["structures"] shouldBe "fort\n"
        fingerprint shouldBe Shelf.fingerprintOf("fort\n")
        rig.shelf.structures.types.keys shouldBe setOf(StructureType("fort"))
        rig.taken.commands.map { it.first.catalogue } shouldContainExactly listOf("structures")
        told shouldContainExactly listOf(mapOf("structures" to fingerprint))
        rig.look().shouldBeEmpty()
    }

    "a revision based on a file that has changed since is refused, and nothing is written" {
        val rig = Rig(mapOf("structures" to "castle\n"))
        rig.shelf.start()

        shouldThrow<CatalogueStale> { rig.shelf.revise("structures", "fort", Shelf.fingerprintOf("mill\n")) }

        rig.folder.written.shouldBeEmpty()
    }

    "a revision the server cannot read, or a name off the shelf, is refused, and nothing is written" {
        val rig = Rig(mapOf("structures" to "castle\n"))
        rig.shelf.start()

        shouldThrow<CatalogueRefused> { rig.shelf.revise("structures", "broken", Shelf.fingerprintOf("castle\n")) }
        shouldThrow<CatalogueRefused> { rig.shelf.revise("../structures", "fort", "") }

        rig.folder.written.shouldBeEmpty()
        rig.shelf.structures.types.keys shouldBe setOf(StructureType("castle"))
    }

    "a server that takes no revisions refuses them" {
        val rig = Rig(mapOf("structures" to "castle\n"), editable = false)
        rig.shelf.start()

        shouldThrow<CataloguesReadOnly> { rig.shelf.revise("structures", "fort", Shelf.fingerprintOf("castle\n")) }
    }
})
