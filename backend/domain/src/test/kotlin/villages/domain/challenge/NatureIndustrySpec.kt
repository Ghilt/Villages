package villages.domain.challenge

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.challenge.Aspect.INDUSTRY
import villages.domain.challenge.Aspect.NATURE
import villages.domain.challenge.Aspect.REASON
import villages.domain.challenge.Aspect.VIOLENCE

class NatureIndustrySpec : StringSpec({

    val hiring = listOf(slice(VIOLENCE, "violence.sellswords", summonCount = 1))

    "a Predator kills an enemy summon its owner's power beats instead of pulling, when its chance comes up, and pulls otherwise" {
        val hunting = TEST_CATALOGUE.withSummon("predator", "kills", 100.0)
        val result = fight(listOf(slice(NATURE, "nature.wildHunt", power = 60.0)), hiring, 4, Happening(REASON), catalogue = hunting)

        result.saying(What.KILLED).single().second shouldBe 1
        result.saying(What.PULLED).filter { it.side == Side.A }.map { it.second to it.amount } shouldBe listOf(2 to 5.0, 3 to 5.0)

        val weak = fight(listOf(slice(NATURE, "nature.wildHunt", power = 40.0)), hiring, 4, Happening(REASON), catalogue = hunting)
        weak.saying(What.KILLED) shouldBe emptyList()
    }

    "Teeming Wilds brings a Creature to its side each time an enemy summon acts, as far as its side has room" {
        val teeming = TEST_CATALOGUE.with("nature.teeming", "chance", 100.0)
        val result = fight(listOf(slice(NATURE, "nature.teeming", summonCount = 2)), hiring, 5, Happening(REASON), catalogue = teeming)

        result.saying(What.SUMMONED).filter { it.effect == "nature.teeming" }.map { it.second } shouldBe listOf(1, 2)
        result.saying(What.NO_ROOM).map { it.second } shouldBe listOf(3, 4)
        result.saying(What.PULLED).filter { it.side == Side.A }.map { it.second to it.amount } shouldBe
            listOf(2 to 3.0, 3 to 3.0, 3 to 3.0, 4 to 3.0, 4 to 3.0)
    }

    "The Wild Remembers pays as the happening changes away from Nature" {
        fight(listOf(slice(NATURE, "nature.wildRemembers")), IDLE, 4, Happening(NATURE), Happening(REASON)).saying(What.PULLED).single().amount shouldBe 30.0
    }

    "a Machine pulls ten a second, and Well-Oiled now and then makes a friend's act pull five more" {
        val oiled = TEST_CATALOGUE.with("industry.wellOiled", "chance", 100.0)
        val result = fight(listOf(slice(INDUSTRY, "industry.engines", "industry.wellOiled")), IDLE, 3, Happening(REASON), catalogue = oiled)

        result.saying(What.PULLED).map { it.effect to it.amount } shouldBe listOf(null to 10.0, "industry.wellOiled" to 5.0, null to 10.0, "industry.wellOiled" to 5.0)
    }

    "Works and Forges puts its building on the line as its slice comes on stage" {
        val works = listOf(slice(INDUSTRY, "industry.works", slotted = mapOf("industry.works" to StandIn.Building("Carron ironworks", 1))))
        fight(works, IDLE, 2, Happening(INDUSTRY)).saying(What.ARRIVED).single().amount shouldBe 15.0
    }
})
