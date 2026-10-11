package villages.application.fate

import villages.application.DialogueEnding
import villages.application.DialoguesByHouse
import villages.domain.Effect
import villages.domain.HouseId
import villages.domain.Omen
import villages.domain.OmenKind
import villages.domain.Resource
import villages.domain.WorldTime
import villages.domain.walk

/**
 * Which month of the year a world-day falls in, one to twelve. A port of its own, because the calendar is
 * `villages.protocol.Calendar`, which this layer may not see, and the season needs nothing else of it. See 0053.
 */
fun interface WorldMonths {
    fun monthOf(day: WorldTime): Int
}

/**
 * The time of year where the house's seat is, as an omen: the northern months turned round south of the equator,
 * so a house in the south has its winter in July.
 */
class SeasonOmens(private val months: WorldMonths) : OmenSource {
    override fun read(moment: Moment): List<Omen> {
        val month = months.monthOf(moment.today)
        val north = SEASONS[(month % 12) / 3]
        val season = if (moment.house.seat.lat < 0) SEASONS[(SEASONS.indexOf(north) + 2) % 4] else north
        return listOf(Omen(OmenKeys.season(season), OmenKind.SEASON, season.replaceFirstChar(Char::uppercase)))
    }

    private companion object {
        /** By the northern months: December to February, March to May, June to August, and the rest. */
        val SEASONS = listOf("winter", "spring", "summer", "autumn")
    }
}

/**
 * What a house had of each resource when it last rolled, or null before its first roll: what *Piety risen* is
 * measured against, income run on to that instant included. Folded from the feed by the projection that keeps it; nothing about it is stored on the roll.
 */
fun interface StandingAtLastRoll {
    fun of(house: HouseId): Map<Resource, Long>?
}

/** Every resource the house has more of than at its last roll, as an omen with how much more. */
class ChangeOmens(private val lastRolls: StandingAtLastRoll) : OmenSource {
    override fun read(moment: Moment): List<Omen> {
        val then = lastRolls.of(moment.house.id) ?: return emptyList()
        return Resource.entries.mapNotNull { resource ->
            val risen = moment.house.stockOf(resource).at(moment.now) - (then[resource] ?: 0)
            Omen(OmenKeys.rose(resource), OmenKind.CHANGE, "${WORDS.getValue(resource)} risen", risen).takeIf { risen > 0 }
        }
    }

    private companion object {
        /** What a player calls each resource: Domain, where the code says natural domain. */
        val WORDS = mapOf(
            Resource.WEALTH to "Wealth",
            Resource.NATURAL_DOMAIN to "Domain",
            Resource.INFLUENCE to "Influence",
            Resource.REASON to "Reason",
            Resource.PIETY to "Piety",
        )
    }
}

/**
 * *Missing wealth*: an open dialogue of the house is waiting on a choice with an option it cannot pay, and the value
 * is the most it is short by. Every open dialogue, whichever is being read, because a debt left waiting is the
 * house's whatever the player is looking at.
 */
class MissingWealthOmens(private val dialogues: DialoguesByHouse) : OmenSource {
    override fun read(moment: Moment): List<Omen> {
        val free = moment.house.stockOf(Resource.WEALTH).at(moment.now) - moment.house.pledgedOf(Resource.WEALTH)
        val short = dialogues.of(moment.house.id)
            .filter { it.ending == DialogueEnding.Open }
            .flatMap { row -> row.dialogue.walk(row.taken).options }
            .maxOfOrNull { option ->
                option.effects.filterIsInstance<Effect.Spend>().filter { it.resource == Resource.WEALTH }.sumOf { it.amount } - free
            } ?: return emptyList()
        return listOfNotNull(Omen(OmenKeys.MISSING_WEALTH, OmenKind.DIALOGUE, "Missing wealth", short).takeIf { short > 0 })
    }
}
