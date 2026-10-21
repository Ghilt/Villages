package villages.domain.challenge

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.challenge.Aspect.AUTHORITY
import villages.domain.challenge.Aspect.FREEDOM
import villages.domain.challenge.Aspect.REASON
import villages.domain.challenge.Aspect.VIOLENCE

class AuthorityFreedomSpec : StringSpec({

    val hiring = listOf(slice(VIOLENCE, "violence.sellswords", summonCount = 1))

    "an Enforcer costs its side five a second, unboosted, and keeps the enemy summon pulling hardest silenced" {
        val anywhere = TEST_CATALOGUE.marked("authority.watch", false).marked("violence.sellswords", false)
        val result = fight(listOf(slice(AUTHORITY, "authority.watch")), hiring, 8, Happening(REASON), catalogue = anywhere)

        result.saying(What.COST).map { it.second to it.amount } shouldBe (1..7).map { it to -5.0 }
        result.saying(What.DEBUFFED).first().let { it.status to it.amount } shouldBe ("silenced" to 3.0)
        result.saying(What.PULLED).filter { it.side == Side.B }.map { it.second } shouldBe listOf(1)
    }

    "an Enforcer's silence is boosted in a happening of its own aspect, and cut to whole seconds" {
        fight(listOf(slice(AUTHORITY, "authority.watch")), hiring, 4, Happening(AUTHORITY, VIOLENCE)).saying(What.DEBUFFED).first().amount shouldBe 4.0
    }

    "a silenced summon does not act until its silence is lifted, and a silence put on again lasts from then" {
        val anywhere = TEST_CATALOGUE.marked("authority.watch", false).marked("violence.sellswords", false)
        val result = fight(listOf(slice(AUTHORITY, "authority.watch")), hiring, 9, Happening(REASON), catalogue = anywhere)

        result.saying(What.DEBUFFED).map { it.second to it.target.toString() } shouldBe (1..8).map { it to "#2" }
        result.saying(What.LIFTED) shouldBe emptyList()
    }

    "Curfew puts every enemy summon under curfew: it sits out a happening without its own aspect until the curfew lifts" {
        val curfew = listOf(slice(AUTHORITY, "authority.curfew"))
        val anywhere = TEST_CATALOGUE.marked("violence.sellswords", false).with("authority.curfew", "seconds", 4.0)
        val result = fight(curfew, hiring, 15, Happening(AUTHORITY), Happening(AUTHORITY), Happening(REASON), catalogue = anywhere)

        result.saying(What.DEBUFFED).map { Triple(it.second, it.status, it.amount) } shouldBe listOf(Triple(5, "underCurfew", 6.0))
        result.saying(What.IDLE).map { it.second } shouldBe listOf(5, 10)
        result.saying(What.LIFTED).map { it.second to it.status } shouldBe listOf(12 to "underCurfew")
        result.saying(What.PULLED).filter { it.side == Side.B }.map { it.second } shouldBe (1..4).toList() + (12..14).toList()
    }

    "The Firm Hand lowers the opponent's power while the tug favours its side" {
        val result = fight(listOf(slice(VIOLENCE, "violence.sellswords"), slice(AUTHORITY, "authority.firmHand")), IDLE, 6, Happening(VIOLENCE), Happening(AUTHORITY))

        val on = result.saying(What.AURA_ON).single()
        on.second shouldBe 3
        on.effect shouldBe "authority.firmHand"
        on.amount shouldBe 7.5
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
