package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.ints.shouldBeInRange
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import villages.domain.CharacterId
import villages.domain.CharacterName
import villages.domain.Sex
import villages.domain.Species
import villages.domain.Stat
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID
import kotlin.random.Random

class NewcomersSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val id = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))
    val today = WorldTime(653_705)

    /** Thirty-day months: the arithmetic under test is the roll's, not the calendar's. */
    val calendar = object : WorldCalendar {
        override fun plusMonths(day: WorldTime, months: Long) = WorldTime(day.day + months * 30)
        override fun monthsBetween(from: WorldTime, to: WorldTime) = (to.day - from.day) / 30
    }
    val lowest = Dice { 1 }
    val highest = Dice { sides -> sides }
    val folder = Portraits { listOf("man-02", "woman-02", "man-01", "woman-01") }

    fun roll(dice: Dice, portraits: Portraits = folder) = Newcomers.roll(id, today, noon, calendar, dice, portraits)

    "with a die that always comes up one, the newcomer is a woman of eighteen with three in everything" {
        val agnes = roll(lowest)

        agnes.characterId shouldBe id
        agnes.sex shouldBe Sex.WOMAN
        agnes.species shouldBe Species.PERSON
        agnes.name shouldBe CharacterName("Agnes", "Achterberg")
        agnes.bornOn shouldBe WorldTime(today.day - 18 * 12 * 30)
        agnes.stats shouldBe Stat.entries.associateWith { 3 }
        agnes.portrait shouldBe "woman-01"
        agnes.worldTime shouldBe today
        agnes.recordedAt shouldBe noon
    }

    "with a die that always comes up its highest, the newcomer is a man of fifty with eighteen in everything" {
        val wilhelm = roll(highest)

        wilhelm.sex shouldBe Sex.MAN
        wilhelm.name shouldBe CharacterName("Wilhelm", "Ystad")
        // Fifty years and eleven months back, and twenty-seven days more.
        wilhelm.bornOn shouldBe WorldTime(today.day - (50 * 12 + 11) * 30 - 27)
        wilhelm.stats shouldBe Stat.entries.associateWith { 18 }
        wilhelm.portrait shouldBe "man-02"
    }

    "a portrait always suits whom it is given to, and there is none when no picture does" {
        val onlyWomen = Portraits { listOf("woman-01", "woman-02") }

        roll(highest, onlyWomen).portrait.shouldBeNull()
        roll(lowest, Portraits { emptyList() }).portrait.shouldBeNull()
        roll(lowest, onlyWomen).portrait!! shouldStartWith "woman-"
    }

    "whom a portrait suits is the first word of its key" {
        Newcomers.suits("woman-01", Sex.WOMAN) shouldBe true
        Newcomers.suits("woman-01", Sex.MAN) shouldBe false
        Newcomers.suits("man-01", Sex.WOMAN) shouldBe false
        Newcomers.suits("man-hat-03", Sex.MAN) shouldBe true
    }

    "every name on the list is a name a character can have" {
        for (sex in Sex.entries) {
            for (given in Names.given(sex)) {
                for (family in Names.family) {
                    CharacterName(given, family)
                }
            }
        }
    }

    "with ordinary dice, every newcomer is eighteen to fifty and every stat is three to eighteen" {
        val random = Random(20260924)
        val dice = Dice { sides -> random.nextInt(1, sides + 1) }

        repeat(500) {
            val newcomer = roll(dice)
            val daysOld = (today.day - newcomer.bornOn.day).toInt()
            daysOld shouldBeInRange (18 * 12 * 30)..(51 * 12 * 30)
            newcomer.stats.values.forEach { it shouldBeInRange 3..18 }
        }
    }
})
