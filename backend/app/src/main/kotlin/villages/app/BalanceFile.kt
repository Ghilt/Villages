package villages.app

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import villages.application.Balance
import villages.domain.Rarity

/**
 * `world/catalogues/balance.json` read into the balance the game decides by: strict, so a number it cannot read
 * refuses the whole file, naming where. A field beginning `$` says what the numbers beside it do, for a reader and for
 * the balance's page, and is passed over here. The shape is a contract, held by `contracts/fixtures/balance.json`,
 * which the world package's `parseBalance` reads too. See decision record 0097.
 */
object BalanceFile {
    private val json = JsonMapper.builder().build()

    fun parse(text: String): Balance {
        val root = json.readTree(text)
        val roll = group(root, "roll")
        val omens = group(root, "omens")
        val islands = group(root, "islands")
        val newcomers = group(root, "newcomers")
        return Balance(
            roll = Balance.Roll(
                price = whole(roll, "roll.price"),
                hand = whole(roll, "roll.hand").toInt(),
                odds = byRarity(roll, "roll.odds").mapValues { (_, chance) -> chance.toInt() },
                grants = byRarity(roll, "roll.grants"),
            ),
            omens = Balance.Omens(
                weakForDays = whole(omens, "omens.weakForDays"),
                piousAt = whole(omens, "omens.piousAt"),
                groundPresent = number(omens, "omens.groundPresent"),
                riversWithinKm = number(omens, "omens.riversWithinKm"),
                housesWithinKm = number(omens, "omens.housesWithinKm"),
                mostHouses = whole(omens, "omens.mostHouses").toInt(),
                townsWithinKm = number(omens, "omens.townsWithinKm"),
                mostTowns = whole(omens, "omens.mostTowns").toInt(),
            ),
            islands = Balance.Islands(smallerThanKm2 = number(islands, "islands.smallerThanKm2")),
            newcomers = Balance.Newcomers(
                youngest = whole(newcomers, "newcomers.youngest").toInt(),
                oldest = whole(newcomers, "newcomers.oldest").toInt(),
            ),
        )
    }

    private fun group(node: JsonNode, name: String): JsonNode = node[name]?.takeIf { it.isObject } ?: refuse(name)

    private fun number(group: JsonNode, at: String): Double =
        group[at.substringAfterLast('.')]?.takeIf { it.isNumber }?.asDouble() ?: refuse(at)

    private fun whole(group: JsonNode, at: String): Long =
        group[at.substringAfterLast('.')]?.takeIf { it.isIntegralNumber }?.asLong() ?: refuse(at)

    /** A number for every rarity, by its name in lower case: `common`, `legendary`. */
    private fun byRarity(group: JsonNode, at: String): Map<Rarity, Long> {
        val each = group[at.substringAfterLast('.')]?.takeIf { it.isObject } ?: refuse(at)
        return Rarity.entries.associateWith { rarity -> whole(each, "$at.${rarity.name.lowercase()}") }
    }

    private fun refuse(at: String): Nothing =
        throw IllegalArgumentException("world/catalogues/balance.json: no $at the server can read")
}
