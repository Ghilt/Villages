package villages.gateway

import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.CharacterError
import villages.domain.DomainError
import villages.domain.HouseError
import villages.domain.Resource
import java.io.File
import kotlin.reflect.KClass

/**
 * The codes refusals carry on the wire, held to `contracts/refusal-codes.txt`: worked out from each error's class name,
 * so a class renamed would change a word the page reads, and this is what says so. See `Refusals.kt`.
 */
class RefusalCodesSpec : StringSpec({
    fun leaves(of: KClass<out DomainError>): List<KClass<out DomainError>> =
        of.sealedSubclasses.flatMap { if (it.isSealed) leaves(it) else listOf(it) }.distinct()

    "every code a refusal gives is kept, and every code kept is one a refusal still gives" {
        val kept = File("../../contracts/refusal-codes.txt").readLines()
            .map(String::trim).filter { it.isNotEmpty() && !it.startsWith("#") }.toSet()
        val given = leaves(DomainError::class).map(::codeOf).toSet()

        withClue("kept, and given by no refusal any more") { (kept - given) shouldBe emptySet() }
        withClue("given, and not yet in contracts/refusal-codes.txt") { (given - kept) shouldBe emptySet() }
    }

    "a refusal's code is its name, the same for a house's and a person's refusal of the same rule" {
        HouseError.NotEnoughFree(Resource.WEALTH, wanted = 5, free = 2).reasonCode() shouldBe "notEnoughFree"
        HouseError.AlreadyFounded.reasonCode() shouldBe "alreadyFounded"
        codeOf(HouseError.InvalidName::class) shouldBe codeOf(CharacterError.InvalidName::class)
    }
})
