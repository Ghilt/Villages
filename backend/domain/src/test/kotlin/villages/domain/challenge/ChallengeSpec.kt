package villages.domain.challenge

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import villages.domain.Stat
import villages.domain.challenge.Aspect.DIPLOMACY
import villages.domain.challenge.Aspect.GREED
import villages.domain.challenge.Aspect.HOLY
import villages.domain.challenge.Aspect.REASON
import villages.domain.challenge.Aspect.VIOLENCE

class ChallengeSpec : StringSpec({

    val hiring = listOf(slice(VIOLENCE, "violence.sellswords", summonCount = 1))

    "a Mercenary pulls ten a second from the second after it is hired, half as much again in a happening of its pair" {
        val unboosted = fight(hiring, IDLE, 5, Happening(REASON))
        unboosted.saying(What.PULLED).map { it.second to it.amount } shouldBe (1..4).map { it to 10.0 }
        unboosted.outcome shouldBe Outcome(40.0, Ending.TIME_RAN_OUT, 4, Side.A, emptyList(), emptyList())

        fight(hiring, IDLE, 5, Happening(VIOLENCE)).outcome.tug shouldBe 60.0
        fight(hiring, IDLE, 5, Happening(DIPLOMACY)).outcome.tug shouldBe 60.0
    }

    "pulled to an end, the challenge stops in that second, and its tug is the end" {
        val pulled = fight(hiring, IDLE, 30, Happening(VIOLENCE))

        pulled.outcome.ended shouldBe Ending.PULLED
        pulled.outcome.second shouldBe 7
        pulled.outcome.tug shouldBe 100.0
        pulled.moments.last().what shouldBe What.ENDED
        pulled.moments.last().tugDelta shouldBe -5.0
        pulled.moments.sumOf { it.tugDelta } shouldBe 100.0
    }

    "a happening puts on stage a slice of its aspect, else one of its anti-aspect, else one drawn from them all" {
        val three = listOf(slice(VIOLENCE, "violence.sellswords"), slice(DIPLOMACY, "diplomacy.parley"), slice(HOLY, "holy.rebuke"))
        val staged = fight(three, IDLE, 3, Happening(HOLY), Happening(REASON), Happening(GREED), seed = 11)
            .saying(What.ON_STAGE).filter { it.side == Side.A }.map { (it.actor as Actor.OfSlice).index }

        staged.take(2) shouldBe listOf(2, 2)
        val drawn = (1L..40L).map { seed ->
            fight(three, IDLE, 1, Happening(GREED), seed = seed).saying(What.ON_STAGE).first { it.side == Side.A }.actor
        }.toSet()
        drawn.size shouldBe 3
    }

    "a side has no more summons than its slices' summon counts together, and one past them has no room" {
        val result = fight(hiring, IDLE, 3, Happening(VIOLENCE), Happening(VIOLENCE), Happening(VIOLENCE))

        result.saying(What.SUMMONED).size shouldBe 1
        result.saying(What.NO_ROOM).size shouldBe 2
    }

    "summons stay when their slice steps aside, and a passive works only while its slice is on stage" {
        val both = listOf(slice(VIOLENCE, "violence.sellswords"), slice(DIPLOMACY, "diplomacy.parley"))
        val result = fight(both, hiring, 10, Happening(VIOLENCE), Happening(DIPLOMACY))

        result.saying(What.PULLED).filter { it.effect == "diplomacy.parley" }.map { it.second } shouldBe (5..9).toList()
        result.saying(What.PULLED).filter { it.side == Side.A && it.actor is Actor.OfSummon }.map { it.second } shouldBe (1..9).toList()
        result.outcome.tug shouldBe 15.0
    }

    "everything in a second reads the state it began with, so a summon killed in a second still acts in it" {
        val killer = listOf(slice(VIOLENCE, "violence.sellswords", "violence.noQuarter", power = 100.0))
        val victim = listOf(slice(VIOLENCE, "violence.sellswords", integrity = 10.0))
        val result = fight(killer, victim, 5, Happening(VIOLENCE), catalogue = TEST_CATALOGUE.with("violence.noQuarter", "chance", 100.0))

        val killed = result.saying(What.KILLED).single()
        killed.second shouldBe 1
        result.saying(What.PULLED).filter { it.side == Side.B }.map { it.second } shouldBe listOf(1)
    }

    "Sweeter Terms turns an enemy summon to its side as the happening begins, so it acts for its new side that second, and one that finds no room deserts" {
        val terms = TEST_CATALOGUE.with("diplomacy.sweeterTerms", "weak", 100.0)
        val turning = fight(hiring, listOf(slice(DIPLOMACY, "diplomacy.sweeterTerms", summonCount = 1)), 4, Happening(VIOLENCE), Happening(DIPLOMACY), catalogue = terms)
        turning.saying(What.TURNED).single().second shouldBe 2
        turning.saying(What.PULLED).filter { it.side == Side.B }.map { it.second } shouldBe listOf(2, 3)

        val deserting = fight(hiring, listOf(slice(DIPLOMACY, "diplomacy.sweeterTerms", summonCount = 0)), 4, Happening(VIOLENCE), Happening(DIPLOMACY), catalogue = terms)
        deserting.saying(What.DESERTED).single().second shouldBe 2
        deserting.saying(What.PULLED).none { it.second == 3 } shouldBe true
    }

    "Endless Parley pulls every second, and lowers the opponent's power while the tug favours them" {
        val result = fight(hiring, listOf(slice(DIPLOMACY, "diplomacy.parley")), 6, Happening(VIOLENCE))

        result.saying(What.PULLED).filter { it.effect == "diplomacy.parley" }.map { it.amount } shouldBe List(6) { 3.0 }
        val on = result.saying(What.AURA_ON).single()
        on.second shouldBe 2
        on.amount shouldBe 7.5
    }

    "Spoils of the Field pays as the happening changes away from Violence, boosted by the happening it changes to" {
        val spoils = listOf(slice(VIOLENCE, "violence.spoils"))
        fight(spoils, IDLE, 4, Happening(VIOLENCE), Happening(DIPLOMACY)).saying(What.PULLED).single().amount shouldBe 45.0
        fight(spoils, IDLE, 4, Happening(VIOLENCE), Happening(REASON)).saying(What.PULLED).single().amount shouldBe 30.0
        fight(spoils, IDLE, 4, Happening(VIOLENCE), Happening(VIOLENCE, REASON)).saying(What.PULLED) shouldBe emptyList()
    }

    "a key figure lends their stat as their slice comes on stage, and an empty slot says so" {
        val ines = StandIn.KeyFigure("Ines", mapOf(Stat.KINDNESS to 12, Stat.REASON to 3))
        val lent = fight(listOf(slice(DIPLOMACY, "diplomacy.envoy", slotted = mapOf("diplomacy.envoy" to ines))), IDLE, 2, Happening(DIPLOMACY))
        lent.saying(What.LENT).single().amount shouldBe 18.0

        fight(IDLE, IDLE, 2, Happening(DIPLOMACY)).saying(What.EMPTY_SLOT).size shouldBe 2
    }

    "an effect whose behaviour is not built yet says so whenever its slice comes on stage" {
        fight(listOf(slice(Aspect.INDUSTRY, "industry.engines")), IDLE, 2, Happening(Aspect.INDUSTRY)).saying(What.NOT_BUILT).single().effect shouldBe "industry.engines"
    }

    "the same seed fights the same challenge, and the changes of its moments add up to its tug" {
        val a = listOf(slice(VIOLENCE, "violence.sellswords", "violence.noQuarter"), slice(DIPLOMACY, "diplomacy.parley"))
        val b = listOf(slice(DIPLOMACY, "diplomacy.sweeterTerms", "diplomacy.parley"), slice(VIOLENCE, "violence.sellswords", "violence.spoils"))
        (1L..30L).forEach { seed ->
            val once = fight(a, b, 40, Happening(VIOLENCE), Happening(DIPLOMACY), Happening(VIOLENCE, DIPLOMACY), Happening(REASON), seed = seed)
            fight(a, b, 40, Happening(VIOLENCE), Happening(DIPLOMACY), Happening(VIOLENCE, DIPLOMACY), Happening(REASON), seed = seed) shouldBe once
            once.moments.sumOf { it.tugDelta } shouldBe (once.outcome.tug plusOrMinus 1e-9)
        }
    }

    "a setup that cannot be fought is refused, saying why" {
        val refused = shouldThrow<IllegalArgumentException> {
            fight(listOf(slice(VIOLENCE, "diplomacy.parley")), List(4) { slice(DIPLOMACY, "diplomacy.parley") }, 0, Happening(VIOLENCE))
        }.message!!
        refused shouldContain "a challenge lasts from 1 to 600 seconds, not 0"
        refused shouldContain "a1 is violence and carries diplomacy.parley, of another aspect"
        refused shouldContain "side B brings 1 to 3 slices, not 4"

        val building = StandIn.Building("Lund", 2)
        shouldThrow<IllegalArgumentException> {
            fight(listOf(slice(DIPLOMACY, "diplomacy.envoy", slotted = mapOf("diplomacy.envoy" to building))), IDLE, 2, Happening(DIPLOMACY))
        }.message!! shouldContain "a1's slot of diplomacy.envoy does not fit Lund"
    }
})
