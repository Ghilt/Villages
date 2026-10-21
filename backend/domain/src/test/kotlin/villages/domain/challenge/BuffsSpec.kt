package villages.domain.challenge

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.Stat
import villages.domain.challenge.Aspect.AUTHORITY
import villages.domain.challenge.Aspect.DIPLOMACY
import villages.domain.challenge.Aspect.FREEDOM
import villages.domain.challenge.Aspect.HOLY
import villages.domain.challenge.Aspect.REASON
import villages.domain.challenge.Aspect.VIOLENCE

class BuffsSpec : StringSpec({

    val hiring = listOf(slice(VIOLENCE, "violence.sellswords", summonCount = 1))

    "the aspect boost is the buff Empowered: a happening puts it on whatever matches it, until the happening ends" {
        val result = fight(hiring, IDLE, 6, Happening(VIOLENCE), Happening(REASON))

        result.saying(What.BUFFED).map { Triple(it.second, it.target.toString(), it.status) } shouldBe
            listOf(Triple(0, "a1", EMPOWERED), Triple(0, "#1", EMPOWERED))
        result.saying(What.LIFTED).map { it.second to it.actor.toString() } shouldBe listOf(3 to "#1", 3 to "a1")
        result.saying(What.PULLED).map { it.second to it.amount } shouldBe listOf(1 to 15.0, 2 to 15.0, 3 to 10.0, 4 to 10.0, 5 to 10.0)

        fight(hiring, IDLE, 3, Happening(VIOLENCE), catalogue = TEST_CATALOGUE.withBuff(EMPOWERED, "percent", 100.0))
            .saying(What.PULLED).map { it.amount } shouldBe listOf(20.0, 20.0)
    }

    "Blessing empowers its side's slices whatever the happening, so a key figure lends half as much again" {
        val ines = StandIn.KeyFigure("Ines", mapOf(Stat.KINDNESS to 12))
        val blessed = listOf(slice(HOLY, "holy.blessing"), slice(DIPLOMACY, "diplomacy.envoy", slotted = mapOf("diplomacy.envoy" to ines)))

        fight(blessed, IDLE, 8, Happening(REASON), Happening(REASON)).saying(What.LENT).map { it.amount } shouldBe listOf(12.0, 18.0)
    }

    "War Drums hastens its side's summons, and a hastened summon acts again in some of its seconds" {
        val drums = listOf(slice(VIOLENCE, "violence.sellswords", "violence.warDrums", summonCount = 1))
        val result = fight(drums, hiring, 8, Happening(VIOLENCE), Happening(VIOLENCE), catalogue = TEST_CATALOGUE.withBuff("hastened", "rate", 100.0))

        result.saying(What.ACTED_AGAIN).map { it.second to it.side } shouldBe (4..7).map { it to Side.A }
    }

    "an echoing slice's trigger fires twice now and then: The Word Spreads, and then the Commons rise twice over" {
        val word = listOf(slice(FREEDOM, "freedom.commons", "freedom.wordSpreads"))
        val result = fight(word, IDLE, 6, Happening(REASON), Happening(REASON), catalogue = TEST_CATALOGUE.withBuff("echoing", "chance", 100.0))

        result.saying(What.SUMMONED).filter { it.effect == "freedom.commons" }.map { it.second } shouldBe listOf(0, 3, 3)
        result.saying(What.ECHOED).filter { it.effect == "freedom.commons" }.map { it.second } shouldBe listOf(3)
    }

    "a warded summon wards off a debuff put on it, one of the same second too, whichever side puts it on" {
        val rising = listOf(slice(FREEDOM, "freedom.commons", summonCount = 1), slice(REASON, "reason.foresight"))
        val curfew = listOf(slice(AUTHORITY, "authority.curfew"))
        val result = fight(rising, curfew, 8, Happening(FREEDOM), Happening(REASON, AUTHORITY))

        result.saying(What.WARDED).map { it.second to it.status } shouldBe listOf(4 to "aspectBound")
        result.saying(What.DEBUFFED) shouldBe emptyList()
    }

    "a steadfast summon is not turned, though it be turned in the second it stood fast" {
        val sworn = listOf(slice(FREEDOM, "freedom.commons", summonCount = 1), slice(AUTHORITY, "authority.fealty"))
        val terms = listOf(slice(DIPLOMACY, "diplomacy.sweeterTerms"))
        val result = fight(sworn, terms, 8, Happening(FREEDOM), Happening(AUTHORITY), catalogue = TEST_CATALOGUE.with("diplomacy.sweeterTerms", "weak", 100.0))

        result.saying(What.HELD).map { it.second to it.actor.toString() } shouldBe listOf(4 to "#1")
        result.saying(What.TURNED) shouldBe emptyList()
    }
})
