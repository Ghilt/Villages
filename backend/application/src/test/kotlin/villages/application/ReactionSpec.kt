package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.domain.DomainError
import villages.domain.HouseError
import kotlin.reflect.KClass

/** A reaction a test drives by hand: it plans whatever it is handed, and hears nothing it acts on. */
private class Planning(later: Later, faults: Faults) : Reaction("a test's reaction", TinyWorld(), later, faults) {
    fun plan(what: String, settled: Set<KClass<out DomainError>> = emptySet(), command: () -> Unit) =
        issueLater(what, settled, command = command)

    override fun apply(stored: StoredEvent) = Unit

    override fun forget() = Unit
}

class ReactionSpec : StringSpec({

    "nothing is issued inside the feed's callback: it waits for Later" {
        val later = ManualLater()
        var ran = false
        Planning(later, KeptFaults()).plan("acting") { ran = true }

        ran shouldBe false
        later.tick()
        ran shouldBe true
    }

    "a refusal that means it is done already is swallowed, and so is a house gone in a wipe" {
        val later = ManualLater()
        val faults = KeptFaults()
        val reaction = Planning(later, faults)

        reaction.plan("giving a pledge back", settled = setOf(HouseError.NoSuchPledge::class)) {
            throw HouseError.NoSuchPledge
        }
        reaction.plan("giving another back") { throw HouseError.NoSuchHouse }
        later.tick()

        faults.reported.shouldBeEmpty()
    }

    "any other refusal is said, under the reaction's name and what it was doing" {
        val later = ManualLater()
        val faults = KeptFaults()

        Planning(later, faults).plan("taking someone in", settled = setOf(HouseError.NoSuchPledge::class)) {
            throw HouseError.TooManyKeyFigures
        }
        later.tick()

        faults.reported.single().describe() shouldStartWith "a test's reaction threw on taking someone in: TooManyKeyFigures"
    }

    "a write conflict the executor could not get past is said too, because the command was never written" {
        val later = ManualLater()
        val faults = KeptFaults()

        Planning(later, faults).plan("losing someone") { throw WriteConflict("house:x", 3) }
        later.tick()

        faults.reported.single().thrown.shouldBeInstanceOf<WriteConflict>()
    }

    "what was planned before a wipe is not issued after it, and what is planned after it is" {
        val later = ManualLater()
        val reaction = Planning(later, KeptFaults())
        val ran = mutableListOf<String>()

        reaction.plan("before") { ran += "before" }
        reaction.reset()
        reaction.plan("after") { ran += "after" }
        later.tick()

        ran shouldBe listOf("after")
    }
})
