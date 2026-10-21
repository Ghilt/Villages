package villages.domain.challenge

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.Stat
import io.kotest.matchers.doubles.plusOrMinus
import villages.domain.challenge.Aspect.DIPLOMACY
import villages.domain.challenge.Aspect.GREED
import villages.domain.challenge.Aspect.INDUSTRY
import villages.domain.challenge.Aspect.NATURE
import villages.domain.challenge.Aspect.REASON
import villages.domain.challenge.Aspect.VIOLENCE

class NatureIndustrySpec : StringSpec({

    val hiring = listOf(slice(VIOLENCE, "violence.sellswords", summonCount = 1))

    "a Predator kills an enemy summon its owner's power beats instead of pulling, when its chance comes up, and pulls otherwise" {
        val hunting = ANYWHERE.withSummon("predator", "kills", 100.0)
        val result = fight(listOf(slice(NATURE, "nature.wildHunt", power = 60.0)), hiring, 4, Happening(REASON), catalogue = hunting)

        result.saying(What.KILLED).single().second shouldBe 1
        result.saying(What.PULLED).filter { it.side == Side.A }.map { it.second to it.amount } shouldBe listOf(2 to 5.0, 3 to 5.0)

        val weak = fight(listOf(slice(NATURE, "nature.wildHunt", power = 40.0)), hiring, 4, Happening(REASON), catalogue = hunting)
        weak.saying(What.KILLED) shouldBe emptyList()
    }

    "Teeming Wilds brings a Creature to its side each time an enemy summon acts, as far as its side has room" {
        val teeming = ANYWHERE.with("nature.teeming", "chance", 100.0)
        val result = fight(listOf(slice(NATURE, "nature.teeming", summonCount = 2)), hiring, 5, Happening(REASON), catalogue = teeming)

        result.saying(What.SUMMONED).filter { it.effect == "nature.teeming" }.map { it.second } shouldBe listOf(1, 2)
        result.saying(What.NO_ROOM).map { it.second } shouldBe listOf(3, 4)
        result.saying(What.PULLED).filter { it.side == Side.A }.map { it.second to it.amount } shouldBe
            listOf(2 to 3.0, 3 to 3.0, 3 to 3.0, 4 to 3.0, 4 to 3.0)
    }

    "a summon whose kind needs a matching aspect sits out a happening without its own, and says so once" {
        val teeming = TEST_CATALOGUE.with("nature.teeming", "chance", 100.0)
        val result = fight(listOf(slice(NATURE, "nature.teeming", summonCount = 2)), hiring, 6, Happening(NATURE, VIOLENCE), Happening(VIOLENCE), catalogue = teeming)

        result.saying(What.SUMMONED).filter { it.effect == "nature.teeming" }.map { it.second } shouldBe listOf(1, 2)
        result.saying(What.PULLED).filter { it.side == Side.A }.map { it.second to it.amount } shouldBe listOf(2 to 4.5)
        result.saying(What.IDLE).map { it.second to it.actor.toString() } shouldBe listOf(3 to "#2", 3 to "#3")
    }

    "Overgrowth answers Industry, eroding the enemy's summons: each act costs integrity until one is gone, and Pick the Bones hears of it" {
        val wild = listOf(slice(NATURE, "nature.overgrowth"), slice(GREED, "greed.pickBones"))
        val result = fight(wild, hiring, 9, Happening(VIOLENCE), Happening(INDUSTRY), Happening(INDUSTRY), catalogue = TEST_CATALOGUE.withDebuff("eroding", "integrity", 20.0))

        result.saying(What.DEBUFFED).single().let { it.second to it.status } shouldBe (3 to "eroding")
        result.saying(What.WORN).map { it.second to it.amount } shouldBe listOf(3 to 20.0, 4 to 20.0, 5 to 10.0)
        result.saying(What.KILLED).single().let { it.second to it.status } shouldBe (5 to "eroding")
        result.saying(What.PULLED).filter { it.effect == "greed.pickBones" }.map { it.second } shouldBe listOf(5)
    }

    "a Machine pulls ten a second, and Well-Oiled now and then hastens a friend as it acts, so that it acts again" {
        val oiled = ANYWHERE.with("industry.wellOiled", "chance", 100.0).withBuff("hastened", "rate", 100.0)
        val result = fight(listOf(slice(INDUSTRY, "industry.engines", "industry.wellOiled")), IDLE, 4, Happening(INDUSTRY), catalogue = oiled)

        result.saying(What.BUFFED).first { it.status == "hastened" }.let { it.second to it.target.toString() } shouldBe (1 to "#1")
        result.saying(What.ACTED_AGAIN).map { it.second } shouldBe listOf(2, 3)
        result.saying(What.PULLED).filter { it.actor.toString() == "#1" }.map { it.second to it.amount } shouldBe
            listOf(1 to 15.0, 2 to 15.0, 2 to 15.0, 3 to 15.0, 3 to 15.0)
    }

    "Works and Forges puts its building on the line as it fires" {
        val works = listOf(slice(INDUSTRY, "industry.works", slotted = mapOf("industry.works" to StandIn.Building("Carron ironworks", 1))))
        fight(works, IDLE, 2, Happening(INDUSTRY)).saying(What.ARRIVED).single().amount shouldBe 15.0
    }

    "Dread of the Wilds weakens every enemy slice, so a key figure of theirs lends a share less" {
        val ines = StandIn.KeyFigure("Ines", mapOf(Stat.KINDNESS to 12))
        val envoy = listOf(slice(DIPLOMACY, "diplomacy.envoy", slotted = mapOf("diplomacy.envoy" to ines)))
        val result = fight(listOf(slice(NATURE, "nature.dread")), envoy, 8, Happening(NATURE), Happening(NATURE))

        val lent = result.saying(What.LENT).map { it.amount!! }
        lent.first() shouldBe 12.0
        lent.last() shouldBe (8.4 plusOrMinus 1e-9)
    }
})
