package villages.application

import villages.domain.Choice
import villages.domain.Rarity
import villages.domain.challenge.ChallengeRules

/**
 * The numbers that belong to no one entry of a catalogue, `world/catalogues/balance.json`, Adam's to tune: what a roll
 * costs and deals, when an omen is read, how small an island is, how old a newcomer can be, a challenge's rules, and
 * how many house bots the world opens with and where they stand. Each is read at the moment it decides something, and
 * what it decided is written into the event, so a retune changes what happens next and never what happened. A number
 * folded from a stored event rather than written into it - a founding's wealth - is not
 * here, because retuning it would rewrite the past. See decision record 0097.
 */
data class Balance(
    val roll: Roll,
    val omens: Omens,
    val islands: Islands,
    val newcomers: Newcomers,
    /** A challenge's numbers that belong to no one effect, which its own type holds to its rules. */
    val challenge: ChallengeRules,
    val houseBots: HouseBots,
) {
    /**
     * A choice roll: what it costs in wealth, how many options it deals, the chance out of a hundred of each rarity,
     * which nothing moves, and what an action of each rarity grants of its resource.
     */
    data class Roll(val price: Long, val hand: Int, val odds: Map<Rarity, Int>, val grants: Map<Rarity, Long>)

    /**
     * When the omens are read: a house is weak for [weakForDays] world-days after its founding and pious from
     * [piousAt] piety; a kind of ground is an omen when it is [groundPresent] of the revealed land in the looking
     * circle; a river when the circle is [riversWithinKm] or less; the nearest [mostHouses] houses and [mostTowns]
     * towns by name when it is [housesWithinKm] and [townsWithinKm] or less.
     */
    data class Omens(
        val weakForDays: Long,
        val piousAt: Long,
        val groundPresent: Double,
        val riversWithinKm: Double,
        val housesWithinKm: Double,
        val mostHouses: Int,
        val townsWithinKm: Double,
        val mostTowns: Int,
    )

    /** A land mass smaller than this is an island: smaller than the smallest continent of the world's master. */
    data class Islands(val smallerThanKm2: Double)

    /** The youngest and the oldest a newcomer can be, in whole years. */
    data class Newcomers(val youngest: Int, val oldest: Int) {
        val ages: IntRange get() = youngest..oldest
    }

    /**
     * The house bots the world opens with: at most [count], each standing [beyondRuinKm] past the edge of the ruin of
     * the town of 1790 it is named after, and none nearer another bot's seat than [apartKm]. See decision record 0108.
     */
    data class HouseBots(val count: Int, val apartKm: Double, val beyondRuinKm: Double)

    /** What must hold of the numbers themselves; throws [CatalogueRefused] naming the place that does not. */
    fun check(): Balance {
        fun refuse(at: String, must: String): Nothing = throw CatalogueRefused(Catalogues.BALANCE, "$at $must")
        if (roll.odds.keys != Rarity.entries.toSet()) refuse("roll.odds", "names every rarity once")
        if (roll.odds.values.any { it < 0 } || roll.odds.values.sum() != HUNDRED) {
            refuse("roll.odds", "are chances out of a hundred, and add up to ${roll.odds.values.sum()}")
        }
        if (roll.grants.keys != Rarity.entries.toSet() || roll.grants.values.any { it <= 0 }) {
            refuse("roll.grants", "names every rarity once, each granting something")
        }
        if (roll.hand !in Choice.FEWEST..Choice.MOST) refuse("roll.hand", "is ${Choice.FEWEST} to ${Choice.MOST} options")
        if (roll.price < 0) refuse("roll.price", "is nothing or more")
        if (omens.mostHouses < 0 || omens.mostTowns < 0 || omens.groundPresent !in 0.0..1.0) {
            refuse("omens", "count from nothing, and ground is present as a share of one")
        }
        if (islands.smallerThanKm2 <= 0) refuse("islands.smallerThanKm2", "is more than nothing")
        if (newcomers.youngest < 0 || newcomers.youngest > newcomers.oldest) {
            refuse("newcomers", "are no younger than nothing, and the youngest no older than the oldest")
        }
        if (houseBots.count < 0 || houseBots.apartKm < 0 || houseBots.beyondRuinKm < 0) {
            refuse("houseBots", "count from nothing, and stand nothing or more apart and beyond a ruin")
        }
        return this
    }

    private companion object {
        const val HUNDRED = 100
    }
}
