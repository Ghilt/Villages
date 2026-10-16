package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import villages.domain.TakeOnCatalogue
import villages.domain.WorldCommand
import villages.domain.WorldTime
import java.time.Instant

class ShelfSpec : StringSpec({

    val noon = Instant.parse("2026-10-16T12:00:00Z")

    /** A world stream that keeps what it is asked to take on, and the story each was asked in. */
    class Taken : WorldCommandExecutor {
        val commands = mutableListOf<Pair<TakeOnCatalogue, Provenance>>()

        override fun execute(command: WorldCommand, provenance: Provenance) {
            commands += (command as TakeOnCatalogue) to provenance
        }
    }

    "every catalogue on the shelf is taken on, by its name, its text and the fingerprint of its bytes, in one story" {
        val taken = Taken()
        val shelf = Shelf(
            { mapOf("structures" to "{}\n", "dialogues/letter" to "{ \"é\": 1 }\n") },
            taken,
            { noon },
            { WorldTime(653_712) },
        )

        shelf.recordAll() shouldBe 2

        taken.commands.map { it.first.catalogue } shouldContainExactly listOf("dialogues/letter", "structures")
        taken.commands.map { it.first.text } shouldContainExactly listOf("{ \"é\": 1 }\n", "{}\n")
        taken.commands.map { it.second.correlationId }.toSet().size shouldBe 1
        taken.commands.first().first.worldTime shouldBe WorldTime(653_712)
    }

    "a fingerprint is the SHA-256 of the file's bytes, as the dev server works it out" {
        // `printf '{}\n' | sha256sum`
        Shelf.fingerprintOf("{}\n") shouldBe "ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356"
    }
})
