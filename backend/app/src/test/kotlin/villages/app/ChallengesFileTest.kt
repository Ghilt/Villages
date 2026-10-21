package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import villages.domain.Stat
import villages.domain.challenge.Aspect
import villages.domain.challenge.Bearer
import villages.domain.challenge.ChallengeSlot
import villages.domain.challenge.Fires
import villages.domain.challenge.Fits
import villages.domain.challenge.Lasting
import villages.domain.challenge.Needs
import java.io.File

/** The challenge's content as the server reads it, held to the fixture the world package's reader is held to. */
class ChallengesFileTest {
    private val fixture = File("../../contracts/fixtures/challenges.json").readText()
    private val real = File("../../world/catalogues/challenges.json").readText()

    @Test
    fun `the fixture reads as it says`() {
        val challenges = ChallengesFile.parse(fixture)

        assertEquals(listOf("violence.sellswords", "violence.noQuarter", "reason.counsel", "holy.sanctuary"), challenges.effects.map { it.id })
        assertEquals(Fires.TRIGGER, challenges.effect("violence.sellswords")?.fires)
        assertEquals("mercenary", challenges.effect("violence.sellswords")?.summons)
        assertEquals(mapOf("chance" to 25.0), challenges.effect("violence.noQuarter")?.numbers)
        assertEquals(ChallengeSlot(Fits.KEY_FIGURE, Stat.REASON), challenges.effect("reason.counsel")?.slot)
        assertEquals(ChallengeSlot(Fits.STRUCTURE, onTheLine = true), challenges.effect("holy.sanctuary")?.slot)
        assertEquals(Aspect.GREED, challenges.summons.getValue("collector").aspect)
        assertEquals(6.5, challenges.summons.getValue("collector").number("deposits"))
        assertEquals(Needs.MATCH, challenges.effect("violence.sellswords")?.needs)
        assertEquals(null, challenges.effect("violence.noQuarter")?.needs)
        assertEquals(Needs.ANTI, challenges.summons.getValue("mercenary").needs)
        assertEquals(null, challenges.summons.getValue("collector").needs)
        assertEquals("weakened", challenges.effect("violence.noQuarter")?.puts)
        assertEquals("hastened", challenges.summons.getValue("collector").puts)
        assertEquals(Lasting(setOf(Bearer.SUMMON, Bearer.SLICE), mapOf("rate" to 50.0)), challenges.buffs.getValue("hastened"))
        assertEquals(Lasting(setOf(Bearer.SLICE), mapOf("percent" to 25.0)), challenges.debuffs.getValue("weakened"))
        val battle = challenges.kinds.getValue("battle")
        assertEquals(30..90, battle.seconds)
        assertEquals(3..6, battle.happenings)
        assertEquals(20.0, battle.twoAspects)
        assertEquals(mapOf(Aspect.VIOLENCE to 8.0, Aspect.HOLY to 1.0), battle.weights)
    }

    @Test
    fun `the real one reads, three or four effects to every aspect, and is in the one form`() {
        val challenges = ChallengesFile.parse(real)

        assertEquals(Aspect.entries.associateWith { if (it in setOf(Aspect.REASON, Aspect.AUTHORITY)) 5 else 4 }, Aspect.entries.associateWith { challenges.effectsOf(it).size })
        assertEquals(setOf("battle", "debate", "tradeWar", "sermon", "even"), challenges.kinds.keys)
        assertEquals(real, CatalogueText.format(real))
    }

    @Test
    fun `a field it cannot read refuses the file, naming where`() {
        assertEquals(
            "world/catalogues/challenges.json: no effects.violence.noQuarter.fires the server can read",
            assertThrows<IllegalArgumentException> { ChallengesFile.parse(fixture.replace("\"passive\"", "\"sometimes\"")) }.message,
        )
        assertEquals(
            "world/catalogues/challenges.json: no effects.violence.sellswords.name the server can read",
            assertThrows<IllegalArgumentException> { ChallengesFile.parse(fixture.replace("\"name\": \"Sellswords\", ", "")) }.message,
        )
        assertEquals(
            "world/catalogues/challenges.json: no effects.violence.sellswords.needs the server can read",
            assertThrows<IllegalArgumentException> { ChallengesFile.parse(fixture.replace("\"needs\": \"match\"", "\"needs\": \"never\"")) }.message,
        )
    }

    @Test
    fun `a rule the content breaks refuses the file, saying where and which`() {
        assertEquals(
            "world/catalogues/challenges.json: effects: violence.sellswords summons hirelings, which is not a summon",
            assertThrows<IllegalArgumentException> { ChallengesFile.parse(fixture.replace("\"summons\": \"mercenary\"", "\"summons\": \"hirelings\"")) }.message,
        )
        assertEquals(
            "world/catalogues/challenges.json: kinds.battle: never more happenings than the fewest seconds, so each begins on a second of its own",
            assertThrows<IllegalArgumentException> { ChallengesFile.parse(fixture.replace("[30, 90]", "[5, 90]")) }.message,
        )
    }
}
