package villages.domain.challenge

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.challenge.Aspect.DIPLOMACY
import villages.domain.challenge.Aspect.HOLY
import villages.domain.challenge.Aspect.VIOLENCE

class ProgressionsSpec : StringSpec({

    val battle = ChallengeKind(30..90, 3..6, 20.0, mapOf(VIOLENCE to 8.0, DIPLOMACY to 2.0, HOLY to 1.0))

    "a kind draws its seconds and its happenings between its least and most, and only aspects that weigh something" {
        (1L..300L).map { Progressions.draw(battle, it) }.forEach { progression ->
            (progression.seconds in 30..90) shouldBe true
            (progression.happenings.size in 3..6) shouldBe true
            progression.happenings.flatMap { it.aspects }.all { it in setOf(VIOLENCE, DIPLOMACY, HOLY) } shouldBe true
        }
    }

    "the same seed draws the same progression" {
        Progressions.draw(battle, 42) shouldBe Progressions.draw(battle, 42)
    }

    "an aspect is drawn about as often as its weight says" {
        val firsts = (1L..2000L).flatMap { seed -> Progressions.draw(battle, seed).happenings.map { it.aspects.first() } }
        val violent = firsts.count { it == VIOLENCE }.toDouble() / firsts.size
        (violent in 0.68..0.78) shouldBe true
    }

    "a happening has a second aspect at the kind's chance, never the same as its first" {
        val always = battle.copy(twoAspects = 100.0)
        (1L..50L).flatMap { Progressions.draw(always, it).happenings }.all { it.aspects.size == 2 && it.aspects[0] != it.aspects[1] } shouldBe true
        (1L..50L).flatMap { Progressions.draw(battle.copy(twoAspects = 0.0), it).happenings }.all { it.aspects.size == 1 } shouldBe true
        Progressions.draw(always.copy(weights = mapOf(VIOLENCE to 1.0)), 7).happenings.all { it.aspects == listOf(VIOLENCE) } shouldBe true
    }
})
