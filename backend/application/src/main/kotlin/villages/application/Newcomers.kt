package villages.application

import villages.domain.CharacterId
import villages.domain.CharacterName
import villages.domain.IntroduceCharacter
import villages.domain.Sex
import villages.domain.Species
import villages.domain.Stat
import villages.domain.WorldTime
import java.time.Instant

/**
 * A newcomer: a character rolled for a house by *add a key figure*, the only way a character comes into
 * the world so far. Not called a stranger, which character dialogue means otherwise.
 *
 * Everything about them is rolled with the dice: a sex, a given name for it and a family name, a birthday
 * eighteen to fifty years back, each stat the sum of three six-sided dice so that most of them sit near ten
 * and a seventeen is worth noticing, and a portrait that suits them if there is one. See decision record
 * 0055 and `docs/plans/characters-and-key-figures.md`.
 */
object Newcomers {
    /** The youngest and the oldest a newcomer can be, in whole years: grown, and with years left. */
    val AGES: IntRange = 18..50

    /** Whom a portrait suits is the first word of its key: `woman-01`, `man-03`. */
    fun suits(key: String, sex: Sex): Boolean = key.startsWith("${sex.name.lowercase()}-")

    fun roll(
        id: CharacterId,
        today: WorldTime,
        now: Instant,
        calendar: WorldCalendar,
        dice: Dice,
        portraits: Portraits,
    ): IntroduceCharacter {
        val sex = if (dice.roll(2) == 1) Sex.WOMAN else Sex.MAN
        val given = Names.given(sex)
        val name = CharacterName(given[dice.roll(given.size) - 1], Names.family[dice.roll(Names.family.size) - 1])

        // A year and a number of months back, then a few days more, so birthdays fall anywhere in a month.
        val years = AGES.first - 1 + dice.roll(AGES.last - AGES.first + 1)
        val months = years * MONTHS_IN_A_YEAR + (dice.roll(MONTHS_IN_A_YEAR) - 1)
        val backByMonths = calendar.plusMonths(today, -months.toLong())
        val bornOn = WorldTime((backByMonths.day - (dice.roll(DAYS_INTO_A_MONTH) - 1)).coerceAtLeast(0))

        val stats = Stat.entries.associateWith { dice.roll(6) + dice.roll(6) + dice.roll(6) }
        val suiting = portraits.keys().filter { suits(it, sex) }.sorted()
        val portrait = if (suiting.isEmpty()) null else suiting[dice.roll(suiting.size) - 1]

        return IntroduceCharacter(
            characterId = id,
            name = name,
            sex = sex,
            species = Species.PERSON,
            bornOn = bornOn,
            stats = stats,
            portrait = portrait,
            worldTime = today,
            recordedAt = now,
        )
    }

    private const val MONTHS_IN_A_YEAR = 12

    /** How far into a month a birthday may fall back, short enough to fit the shortest one. */
    private const val DAYS_INTO_A_MONTH = 28
}
