package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import java.time.Instant

class WorldDeciderSpec : StringSpec({

    val noon = Instant.parse("2026-10-16T12:00:00Z")
    val first = "a".repeat(64)
    val second = "b".repeat(64)

    /** Says where two texts differ as the server would, by naming both, so a test can see what it was given. */
    val decider = WorldDecider { before, after -> listOf("$before->$after") }

    fun takeOn(fingerprint: String, text: String, catalogue: String = "structures") =
        TakeOnCatalogue(catalogue, text, fingerprint, WorldTime(653_712), noon)

    "the first version of a catalogue is recorded whole, with nothing before it" {
        decider.decide(takeOn(first, "{one}"), decider.initial) shouldBe listOf(
            WorldCatalogueChanged("structures", first, null, emptyList(), "{one}", WorldTime(653_712), noon),
        )
    }

    "the version last recorded is taken on again without a word" {
        val record = decider.fold(decider.decide(takeOn(first, "{one}"), decider.initial))

        decider.decide(takeOn(first, "{one}"), record).shouldBeEmpty()
    }

    "a new version names the one it replaced and where they differ" {
        val record = decider.fold(decider.decide(takeOn(first, "{one}"), decider.initial))

        decider.decide(takeOn(second, "{two}"), record) shouldBe listOf(
            WorldCatalogueChanged("structures", second, first, listOf("{one}->{two}"), "{two}", WorldTime(653_712), noon),
        )
    }

    "each catalogue is its own, folders and all" {
        val record = decider.fold(decider.decide(takeOn(first, "{one}"), decider.initial))

        (decider.decide(takeOn(first, "{one}", catalogue = "dialogues/letter"), record).single() as WorldCatalogueChanged).previous shouldBe null
    }

    "a name off the shelf or a fingerprint that is not one is refused" {
        shouldThrow<WorldError.InvalidCatalogue> { decider.decide(takeOn(first, "{}", catalogue = "../world"), decider.initial) }
        shouldThrow<WorldError.InvalidCatalogue> { decider.decide(takeOn(first, "{}", catalogue = "Structures"), decider.initial) }
        shouldThrow<WorldError.InvalidCatalogue> { decider.decide(takeOn("abc", "{}"), decider.initial) }
    }
})
