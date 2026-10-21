package villages.domain.challenge

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.Stat
import villages.domain.challenge.Aspect.AUTHORITY
import villages.domain.challenge.Aspect.DIPLOMACY
import villages.domain.challenge.Aspect.FREEDOM
import villages.domain.challenge.Aspect.REASON
import villages.domain.challenge.Aspect.VIOLENCE

class AuthorityFreedomSpec : StringSpec({

    val hiring = listOf(slice(VIOLENCE, "violence.sellswords", summonCount = 1))

    "an Enforcer costs its side five a second, unboosted, and keeps the enemy summon pulling hardest stunned" {
        val anywhere = TEST_CATALOGUE.marked("authority.watch", false).marked("violence.sellswords", false)
        val result = fight(listOf(slice(AUTHORITY, "authority.watch")), hiring, 8, Happening(REASON), catalogue = anywhere)

        result.saying(What.COST).map { it.second to it.amount } shouldBe (1..7).map { it to -5.0 }
        result.saying(What.DEBUFFED).first().let { it.status to it.amount } shouldBe ("stunned" to 3.0)
        result.saying(What.PULLED).filter { it.side == Side.B }.map { it.second } shouldBe listOf(1)
    }

    "an Enforcer's stun is boosted in a happening of its own aspect, and cut to whole seconds" {
        fight(listOf(slice(AUTHORITY, "authority.watch")), hiring, 4, Happening(AUTHORITY, VIOLENCE)).saying(What.DEBUFFED).first().amount shouldBe 4.0
    }

    "a stunned summon does not act until the stun is lifted, and a stun put on again lasts from then" {
        val anywhere = TEST_CATALOGUE.marked("authority.watch", false).marked("violence.sellswords", false)
        val result = fight(listOf(slice(AUTHORITY, "authority.watch")), hiring, 9, Happening(REASON), catalogue = anywhere)

        result.saying(What.DEBUFFED).map { it.second to it.target.toString() } shouldBe (1..8).map { it to "#2" }
        result.saying(What.LIFTED) shouldBe emptyList()
    }

    "Curfew makes every enemy summon aspect-bound: it sits out a happening without its own aspect until that lifts" {
        val curfew = listOf(slice(AUTHORITY, "authority.curfew"))
        val anywhere = TEST_CATALOGUE.marked("violence.sellswords", false).with("authority.curfew", "seconds", 4.0)
        val result = fight(curfew, hiring, 15, Happening(AUTHORITY), Happening(AUTHORITY), Happening(REASON), catalogue = anywhere)

        result.saying(What.DEBUFFED).map { Triple(it.second, it.status, it.amount) } shouldBe listOf(Triple(5, "aspectBound", 6.0))
        result.saying(What.IDLE).map { it.second } shouldBe listOf(5, 10)
        result.saying(What.LIFTED).filter { it.status == "aspectBound" }.map { it.second to it.status } shouldBe listOf(12 to "aspectBound")
        result.saying(What.PULLED).filter { it.side == Side.B }.map { it.second } shouldBe (1..4).toList() + (12..14).toList()
    }

    "The Firm Hand penalises the enemy's slices: each trigger they fire off their aspect costs their side, and one on it nothing" {
        val ines = StandIn.KeyFigure("Ines", mapOf(Stat.KINDNESS to 12))
        val envoy = listOf(slice(DIPLOMACY, "diplomacy.envoy", slotted = mapOf("diplomacy.envoy" to ines)))
        val result = fight(listOf(slice(AUTHORITY, "authority.firmHand")), envoy, 12, Happening(AUTHORITY), Happening(AUTHORITY), Happening(DIPLOMACY))

        result.saying(What.DEBUFFED).map { Triple(it.second, it.status, it.target.toString()) } shouldBe
            listOf(Triple(0, "penalised", "b1"), Triple(4, "penalised", "b1"))
        result.saying(What.PENALISED).map { Triple(it.second, it.effect, it.amount) } shouldBe listOf(Triple(4, "diplomacy.envoy", -8.0))
        result.saying(What.PENALISED).single().tugDelta shouldBe 8.0
    }

    "a Rebel pulls five a second, and ten while its side is behind" {
        val result = fight(listOf(slice(FREEDOM, "freedom.commons")), hiring, 5, Happening(VIOLENCE))

        result.saying(What.PULLED).filter { it.side == Side.A }.map { it.amount } shouldBe listOf(5.0, 10.0, 10.0, 10.0)
    }

    "Against the Grain pays at each happening its slice's aspect does not match, and not at one it does" {
        val grain = listOf(slice(FREEDOM, "freedom.againstTheGrain"))
        fight(grain, IDLE, 3, Happening(REASON), Happening(FREEDOM), Happening(AUTHORITY)).saying(What.PULLED).map { it.second to it.amount } shouldBe
            listOf(0 to 20.0, 2 to 20.0)
    }

    "Will of One's Own keeps its slice's aspect matching once, at a change to a happening that does not have it, and its triggers that need a match fire there" {
        val result = fight(
            listOf(slice(FREEDOM, "freedom.ownWill", "freedom.commons"), slice(VIOLENCE, "violence.sellswords")),
            IDLE,
            6,
            Happening(FREEDOM),
            Happening(VIOLENCE),
            Happening(VIOLENCE),
            catalogue = TEST_CATALOGUE.marked("freedom.commons", true),
        )

        result.saying(What.MATCHES).filter { it.side == Side.A }.map { it.actor.toString() to it.effect } shouldBe
            listOf("a1" to null, "a1" to "freedom.ownWill", "a2" to null, "a2" to null)
        result.saying(What.SUMMONED).filter { it.effect == "freedom.commons" }.size shouldBe 2
    }
})
