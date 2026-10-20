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
        val result = fight(listOf(slice(AUTHORITY, "authority.watch")), hiring, 8, Happening(REASON))

        result.saying(What.COST).map { it.second to it.amount } shouldBe (1..7).map { it to -5.0 }
        result.saying(What.SILENCED).first().amount shouldBe 3.0
        result.saying(What.PULLED).filter { it.side == Side.B }.map { it.second } shouldBe listOf(1)
    }

    "an Enforcer's silence is boosted in a happening of its pair, and cut to whole seconds" {
        fight(listOf(slice(AUTHORITY, "authority.watch")), hiring, 4, Happening(AUTHORITY)).saying(What.SILENCED).first().amount shouldBe 4.0
    }

    "By Decree stops an enemy summon's act when its slice's power beats the summon's integrity" {
        val certain = TEST_CATALOGUE.with("authority.decree", "chance", 100.0)
        val stopping = fight(listOf(slice(AUTHORITY, "authority.decree", power = 60.0)), hiring, 4, Happening(VIOLENCE), catalogue = certain)
        stopping.saying(What.STOPPED).map { it.second } shouldBe listOf(1, 2, 3)
        stopping.saying(What.PULLED) shouldBe emptyList()

        fight(listOf(slice(AUTHORITY, "authority.decree", power = 40.0)), hiring, 4, Happening(VIOLENCE), catalogue = certain)
            .saying(What.STOPPED) shouldBe emptyList()
    }

    "The Firm Hand lowers the opponent's power while the tug favours its side" {
        val result = fight(listOf(slice(VIOLENCE, "violence.sellswords"), slice(AUTHORITY, "authority.firmHand")), IDLE, 6, Happening(VIOLENCE), Happening(AUTHORITY))

        val on = result.saying(What.AURA_ON).single()
        on.second shouldBe 3
        on.effect shouldBe "authority.firmHand"
        on.amount shouldBe 7.5
    }

    "a Rebel pulls five a second, and ten while its side is behind" {
        val result = fight(listOf(slice(FREEDOM, "freedom.commons")), hiring, 5, Happening(REASON))

        result.saying(What.PULLED).filter { it.side == Side.A }.map { it.amount } shouldBe listOf(5.0, 10.0, 10.0, 10.0)
    }

    "Against the Grain pays when its slice comes on stage by the draw, and not when an aspect puts it there" {
        val grain = listOf(slice(FREEDOM, "freedom.againstTheGrain"))
        fight(grain, IDLE, 2, Happening(REASON)).saying(What.PULLED).single().amount shouldBe 20.0
        fight(grain, IDLE, 2, Happening(AUTHORITY)).saying(What.PULLED) shouldBe emptyList()
    }

    "Will of One's Own keeps its slice on stage once, at a change that would not keep it, and triggers fire again" {
        val result = fight(
            listOf(slice(FREEDOM, "freedom.ownWill", "freedom.commons"), slice(VIOLENCE, "violence.sellswords")),
            IDLE,
            6,
            Happening(FREEDOM),
            Happening(VIOLENCE),
            Happening(VIOLENCE),
        )

        result.saying(What.ON_STAGE).filter { it.side == Side.A }.map { it.actor.toString() to it.effect } shouldBe
            listOf("a1" to null, "a1" to "freedom.ownWill", "a2" to null)
        result.saying(What.SUMMONED).filter { it.effect == "freedom.commons" }.size shouldBe 2
    }
})
