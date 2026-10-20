package villages.domain.challenge

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.Stat

class ChallengeCatalogueSpec : StringSpec({

    "every aspect has an anti-aspect, and the anti-aspect's is the aspect again" {
        Aspect.VIOLENCE.anti shouldBe Aspect.DIPLOMACY
        Aspect.REASON.anti shouldBe Aspect.HOLY
        Aspect.FREEDOM.anti shouldBe Aspect.AUTHORITY
        Aspect.GREED.anti shouldBe Aspect.GENEROSITY
        Aspect.INDUSTRY.anti shouldBe Aspect.NATURE
        Aspect.entries.all { it.anti.anti == it && it.anti != it } shouldBe true
    }

    "an effect's id begins with its aspect, and its numbers are nothing or more" {
        shouldThrow<IllegalArgumentException> { ChallengeEffect("holy.sellswords", Aspect.VIOLENCE, Fires.TRIGGER) }
        shouldThrow<IllegalArgumentException> { ChallengeEffect("violence.spoils", Aspect.VIOLENCE, Fires.PASSIVE, mapOf("amount" to -1.0)) }
    }

    "only a key figure lends a stat, and a slot lends one or puts what is in it on the line" {
        shouldThrow<IllegalArgumentException> { ChallengeSlot(Fits.STRUCTURE, Stat.REASON) }
        shouldThrow<IllegalArgumentException> { ChallengeSlot(Fits.STRUCTURE) }
        ChallengeSlot(Fits.KEY_FIGURE, Stat.KINDNESS).onTheLine shouldBe false
    }

    "an effect summons only what the catalogue has, and no two effects share an id" {
        val hire = ChallengeEffect("violence.sellswords", Aspect.VIOLENCE, Fires.TRIGGER, summons = "mercenary")
        shouldThrow<IllegalArgumentException> { ChallengeCatalogue(listOf(hire), emptyMap(), emptyMap()) }
        shouldThrow<IllegalArgumentException> {
            ChallengeCatalogue(listOf(hire, hire), mapOf("mercenary" to SummonSpec(Aspect.VIOLENCE)), emptyMap())
        }
        val catalogue = ChallengeCatalogue(listOf(hire), mapOf("mercenary" to SummonSpec(Aspect.VIOLENCE)), emptyMap())
        catalogue.effectsOf(Aspect.VIOLENCE) shouldBe listOf(hire)
        catalogue.effectsOf(Aspect.HOLY) shouldBe emptyList()
    }

    "a kind has happenings that each begin on a second of their own, and some aspect weighing something" {
        val battle = ChallengeKind(30..90, 3..6, 20.0, mapOf(Aspect.VIOLENCE to 8.0))
        battle.happenings shouldBe 3..6
        shouldThrow<IllegalArgumentException> { battle.copy(seconds = 5..90) }
        shouldThrow<IllegalArgumentException> { battle.copy(happenings = 0..2) }
        shouldThrow<IllegalArgumentException> { battle.copy(twoAspects = 101.0) }
        shouldThrow<IllegalArgumentException> { battle.copy(weights = mapOf(Aspect.VIOLENCE to 0.0)) }
    }
})
