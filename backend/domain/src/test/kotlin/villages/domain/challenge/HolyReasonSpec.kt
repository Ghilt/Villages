package villages.domain.challenge

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.Resource
import villages.domain.Stat
import villages.domain.challenge.Aspect.HOLY
import villages.domain.challenge.Aspect.REASON
import villages.domain.challenge.Aspect.VIOLENCE

class HolyReasonSpec : StringSpec({

    val lund = StandIn.Building("Cathedral of Lund", 2)
    val sanctuary = listOf(slice(HOLY, "holy.sanctuary", slotted = mapOf("holy.sanctuary" to lund)))
    val hiring = listOf(slice(VIOLENCE, "violence.sellswords", summonCount = 1))

    "a building on the line arrives paying ten a level, then pulls a fifth of that a second, once in the challenge" {
        val result = fight(sanctuary, IDLE, 6, Happening(HOLY), Happening(HOLY))

        val arrived = result.saying(What.ARRIVED).single()
        arrived.second shouldBe 0
        arrived.amount shouldBe 30.0
        (arrived.actor as Actor.OfSummon).called shouldBe "Cathedral of Lund"
        result.saying(What.PULLED).map { it.amount } shouldBe List(5) { 6.0 }
    }

    "a building on the line that wins pays its piety, and one killed is damaged and pays none" {
        val won = fight(sanctuary, IDLE, 6, Happening(HOLY))
        won.outcome.gains shouldBe listOf(Gain(Side.A, Resource.PIETY, 5.0, "holy.sanctuary"))

        val killers = listOf(slice(VIOLENCE, "violence.sellswords", "violence.noQuarter", power = 100.0))
        val lost = fight(sanctuary, killers, 6, Happening(HOLY, VIOLENCE), catalogue = TEST_CATALOGUE.with("violence.noQuarter", "chance", 100.0))
        lost.saying(What.KILLED).single().target shouldBe Actor.OfSummon(1, Actor.ON_THE_LINE, "Cathedral of Lund")
        lost.outcome.losses shouldBe listOf(Loss(Side.A, "Cathedral of Lund", Fits.STRUCTURE, 10.0, "holy.sanctuary"))
        lost.outcome.gains shouldBe emptyList()
    }

    "a building is harder to kill than its slice: its integrity is its slice's and half what it arrived with" {
        val killers = listOf(slice(VIOLENCE, "violence.sellswords", "violence.noQuarter", power = 55.0))
        val result = fight(sanctuary, killers, 6, Happening(HOLY, VIOLENCE), catalogue = TEST_CATALOGUE.with("violence.noQuarter", "chance", 100.0))

        result.saying(What.KILLED) shouldBe emptyList()
    }

    "the Priest pulls the integrity its side stands above the enemy's, and grows as Divine Rebuke wears the enemy down" {
        val holy = listOf(slice(HOLY, "holy.ordination", "holy.rebuke"))
        val result = fight(holy, hiring, 5, Happening(HOLY), catalogue = ANYWHERE.with("holy.rebuke", "chance", 100.0))

        result.saying(What.PULLED).filter { it.side == Side.A }.map { it.amount } shouldBe listOf(0.0, 22.5, 45.0, 67.5)
        result.saying(What.INTEGRITY_LOST).map { it.amount } shouldBe List(4) { 15.0 }
    }

    "Refutation cancels an enemy trigger before it fires" {
        val refuting = listOf(slice(REASON, "reason.refutation"))
        val result = fight(refuting, hiring, 3, Happening(VIOLENCE), catalogue = TEST_CATALOGUE.with("reason.refutation", "chance", 100.0))

        val cancelled = result.saying(What.CANCELLED).single()
        cancelled.effect shouldBe "reason.refutation"
        cancelled.targetEffect shouldBe "violence.sellswords"
        result.saying(What.SUMMONED) shouldBe emptyList()
    }

    "Seen Through pulls each time an enemy summon acts, when its chance comes up" {
        val seeing = listOf(slice(REASON, "reason.seenThrough"))
        val result = fight(seeing, hiring, 4, Happening(VIOLENCE), catalogue = TEST_CATALOGUE.with("reason.seenThrough", "chance", 100.0))

        result.saying(What.PULLED).filter { it.effect == "reason.seenThrough" }.map { it.second to it.amount } shouldBe (1..3).map { it to 5.0 }
    }

    "Learned Counsel lends the counsellor's reason, and a counsellor put on the line comes on it once and can be fatigued" {
        val agnes = StandIn.KeyFigure("Agnes", mapOf(Stat.REASON to 12))
        val counsel = listOf(slice(REASON, "reason.counsel", slotted = mapOf("reason.counsel" to agnes)))
        fight(counsel, IDLE, 2, Happening(REASON)).saying(What.LENT).single().amount shouldBe 18.0

        val onTheLine = ANYWHERE.copy(
            effects = ANYWHERE.effects.map { if (it.id == "reason.counsel") it.copy(slot = it.slot!!.copy(onTheLine = true)) else it },
        ).with("violence.noQuarter", "chance", 100.0)
        val killers = listOf(slice(VIOLENCE, "violence.sellswords", "violence.noQuarter", power = 100.0))
        val risked = fight(counsel, killers, 4, Happening(REASON), Happening(REASON), catalogue = onTheLine)
        risked.saying(What.ARRIVED).single().amount shouldBe 18.0
        risked.saying(What.LENT) shouldBe emptyList()
        risked.outcome.losses shouldBe listOf(Loss(Side.A, "Agnes", Fits.KEY_FIGURE, 10.0, "reason.counsel"))
    }
})
