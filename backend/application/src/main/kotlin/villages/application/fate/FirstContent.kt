package villages.application.fate

import villages.domain.Effect
import villages.domain.Omen
import villages.domain.OmenKey
import villages.domain.Rarity
import villages.domain.Resource

/**
 * The first pools: Hearth, always open and holding everything, and one more for each resource, opened by the omens
 * that point at it. A pool that opens on an omen nobody reads yet - a river, the winter - is ready for the source
 * that will. See `docs/plans/choice-roll.md`, the pools and the first actions.
 */
object FirstPools {
    private fun OmenKey.startsWith(prefix: String) = value.startsWith(prefix)

    val COIN = Pool("Coin") { it.key in setOf(OmenKeys.MISSING_WEALTH, OmenKeys.RIVER, OmenKeys.COAST, OmenKeys.WEAK) }
    val LAND = Pool("Land") { it.key.startsWith("house.holdings:") || it.key.startsWith("map.ground:") }
    val COURT = Pool("Court") {
        it.key.startsWith("map.house:") || it.key.startsWith("window.house:") || it.key.startsWith("figure:")
    }
    val LEARNING = Pool("Learning") { it.key == OmenKeys.WINTER || it.key.startsWith("window.character:") }
    val FAITH = Pool("Faith") { it.key == OmenKeys.PIOUS || it.key == OmenKeys.rose(Resource.PIETY) }

    val ALL = listOf(Pool.HEARTH, COIN, LAND, COURT, LEARNING, FAITH)
}

/**
 * The first actions: one of each rarity for each resource, giving 15, 40, 120 or 400 of it. A first draft of the
 * words, for Adam to change; a house gains influence over what is already there more often than it builds anew.
 */
object ResourceActions {
    /** What an action of each rarity gives. A common pays a roll back and a little more. */
    val AMOUNTS: Map<Rarity, Long> = mapOf(
        Rarity.COMMON to 15,
        Rarity.UNCOMMON to 40,
        Rarity.RARE to 120,
        Rarity.LEGENDARY to 400,
    )

    private val wordsFor: Map<Resource, Pair<Pool, List<Pair<String, String>>>> = mapOf(
        Resource.WEALTH to (FirstPools.COIN to listOf(
            "Collect the mill's dues" to "The miller pays what he owes, and a little early.",
            "A merchant's debt is paid early" to "He wants your goodwill more than he wants his coin.",
            "A wreck's cargo comes ashore on your land" to "Salvage is the lord's by old right.",
            "Silver is found under the home farm" to "The plough turned up a seam of it.",
        )),
        Resource.NATURAL_DOMAIN to (FirstPools.LAND to listOf(
            "Take the lease of a neighbouring field" to "Its tenant is old and his sons have gone.",
            "The widow's farm passes to the house" to "She asked for nothing but a place by the fire.",
            "A border wood is granted by charter" to "The seal is old and nobody alive remembers why.",
            "A county falls to the house by marriage contract" to "The ink is barely dry, and the land is yours.",
        )),
        Resource.INFLUENCE to (FirstPools.COURT to listOf(
            "Dine with the reeve" to "He talks, and remembers who listened.",
            "Stand godparent to a neighbour's child" to "A tie that will outlast both houses' quarrels.",
            "A seat on the regional council" to "Your voice is heard where the roads are decided.",
            "The Crown's ear" to "A word from you reaches the throne before your rivals'.",
        )),
        Resource.REASON to (FirstPools.LEARNING to listOf(
            "Read in the long evenings" to "Candles are cheap, and the books were already here.",
            "Engage a tutor for the household" to "A thin man with a great many opinions.",
            "Correspond with a scholar abroad" to "Her letters arrive months late and worth the wait.",
            "A dead bishop's library comes to the house" to "Four carts of books, and two of them in no language you know.",
        )),
        Resource.PIETY to (FirstPools.FAITH to listOf(
            "Hear mass with the village" to "They notice who comes, and who does not.",
            "Endow the chapel's candles" to "A small light in your name, every evening.",
            "Shelter a pilgrim of renown" to "She blesses the house on leaving, and is heard to.",
            "A relic is entrusted to the house" to "A finger bone in a silver box, and a great many visitors.",
        )),
    )

    val ALL: List<Action> = wordsFor.flatMap { (resource, poolAndWords) ->
        val (pool, words) = poolAndWords
        Rarity.entries.zip(words).map { (rarity, labelAndDetail) ->
            val (label, detail) = labelAndDetail
            val amount = AMOUNTS.getValue(rarity)
            Action(
                id = "${resource.name.lowercase()}.${rarity.name.lowercase()}",
                rarity = rarity,
                pools = setOf(Pool.HEARTH, pool),
            ) { _, _: List<Omen> -> Dealt(label, detail, Effect.Grant(resource, amount)) }
        }
    }
}
