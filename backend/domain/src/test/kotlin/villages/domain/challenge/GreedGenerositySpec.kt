package villages.domain.challenge

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.Resource
import villages.domain.Stat
import villages.domain.challenge.Aspect.AUTHORITY
import villages.domain.challenge.Aspect.GENEROSITY
import villages.domain.challenge.Aspect.GREED
import villages.domain.challenge.Aspect.REASON
import villages.domain.challenge.Aspect.VIOLENCE

class GreedGenerositySpec : StringSpec({

    val killers = listOf(slice(VIOLENCE, "violence.sellswords", "violence.noQuarter", power = 100.0))
    val certain = ANYWHERE.with("violence.noQuarter", "chance", 100.0)

    "a Collector costs its side three a second and fills its coffer with six, which pours at the next change and at the end" {
        val result = fight(listOf(slice(GREED, "greed.farmTaxes")), IDLE, 6, Happening(REASON), Happening(REASON), catalogue = ANYWHERE)

        result.saying(What.BANKED).take(2).map { it.amount } shouldBe listOf(6.0, 6.0)
        result.saying(What.COST).first().amount shouldBe -3.0
        result.saying(What.POURED).map { it.second to it.amount } shouldBe listOf(3 to 12.0, 5 to 18.0, 5 to 12.0)
    }

    "a Collector's coffer is lost with it when it is killed" {
        val result = fight(listOf(slice(GREED, "greed.farmTaxes")), killers, 4, Happening(REASON), catalogue = certain)

        result.saying(What.COFFER_LOST).single().amount shouldBe 6.0
        result.saying(What.POURED) shouldBe emptyList()
    }

    "Pick the Bones pulls whenever an enemy summon is killed" {
        val hound = object : SummonBehaviour {
            override fun pull(scene: Scene, summon: Summon): Double = 0.0

            override fun act(scene: Scene, summon: Summon): List<Change> =
                scene.summons(summon.side.other).take(1).map { Change.Kill(it.serial, summon.actor, null) }
        }
        val kennel = ANYWHERE.copy(
            effects = ANYWHERE.effects + ChallengeEffect("greed.kennel", GREED, Fires.TRIGGER, summons = "hound"),
            summons = ANYWHERE.summons + ("hound" to SummonSpec(GREED)),
        )
        val setup = ChallengeSetup(
            listOf(slice(GREED, "greed.kennel", "greed.pickBones")),
            listOf(slice(VIOLENCE, "violence.sellswords")),
            Progression(4, listOf(Happening(REASON))),
        )
        val effects = ChallengeBehaviours.effects + ("greed.kennel" to Hires)
        val result = Challenge.resolve(setup, 1, kennel, TEST_RULES, effects, ChallengeBehaviours.summons + ("hound" to hound))

        result.saying(What.KILLED).single().second shouldBe 1
        result.saying(What.PULLED).filter { it.effect == "greed.pickBones" }.map { it.amount } shouldBe listOf(10.0)
    }

    "Remembered Kindness pulls whenever a summon of its own side is killed" {
        val result = fight(listOf(slice(GENEROSITY, "generosity.alms", "generosity.remembered")), killers, 4, Happening(REASON), catalogue = certain)

        result.saying(What.PULLED).filter { it.effect == "generosity.remembered" }.map { it.second to it.amount } shouldBe listOf(1 to 15.0)
    }

    "a Benefactor pulls five a second, and ten while its side is behind" {
        val hiring = listOf(slice(VIOLENCE, "violence.sellswords", summonCount = 1))
        val result = fight(listOf(slice(GENEROSITY, "generosity.alms")), hiring, 4, Happening(REASON), catalogue = ANYWHERE)

        result.saying(What.PULLED).filter { it.side == Side.A }.map { it.amount } shouldBe listOf(5.0, 10.0, 10.0)
    }

    "Counting House puts its building on the line as it fires, and pays wealth when won" {
        val house = listOf(slice(GREED, "greed.countingHouse", slotted = mapOf("greed.countingHouse" to StandIn.Building("Fugger house", 3))))
        val result = fight(house, IDLE, 3, Happening(GREED))

        result.saying(What.ARRIVED).single().amount shouldBe 45.0
        result.outcome.gains shouldBe listOf(Gain(Side.A, Resource.WEALTH, 5.0, "greed.countingHouse"))
    }

    "Open-Handed Patron lends the patron's kindness" {
        val ines = StandIn.KeyFigure("Ines", mapOf(Stat.KINDNESS to 14))
        val patron = listOf(slice(GENEROSITY, "generosity.patron", slotted = mapOf("generosity.patron" to ines)))
        fight(patron, IDLE, 2, Happening(GENEROSITY)).saying(What.LENT).single().amount shouldBe 21.0
    }

    "Tend the Wounded lifts every debuff on its side, one put on in its own second too, so a summon never sits out aspect-bound" {
        val tending = listOf(slice(GENEROSITY, "generosity.alms", "generosity.tend", summonCount = 1))
        val curfew = listOf(slice(AUTHORITY, "authority.curfew"))
        val result = fight(tending, curfew, 12, Happening(AUTHORITY), Happening(AUTHORITY), Happening(REASON))

        result.saying(What.DEBUFFED).single().let { it.second to it.status } shouldBe (4 to "aspectBound")
        result.saying(What.CLEANSED).single().let { Triple(it.second, it.status, it.target.toString()) } shouldBe Triple(4, "aspectBound", "#1")
        result.saying(What.PULLED).filter { it.side == Side.A }.map { it.second } shouldBe (1..11).toList()
    }
})
