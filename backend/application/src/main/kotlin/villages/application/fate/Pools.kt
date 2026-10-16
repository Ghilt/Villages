package villages.application.fate

import villages.domain.Effect
import villages.domain.Omen
import villages.domain.Rarity

/**
 * A named grouping of actions, opened by omens: the game's own filing and never shown to the player, so pools can be
 * reorganised without anybody noticing. An action in more open pools is likelier to be dealt. It opens on an omen
 * whose key one of [opensOn] names: the key exactly, or, ending in `*`, every key beginning with what comes before.
 */
data class Pool(val name: String, val opensOn: List<String>) {
    fun opensOn(omen: Omen): Boolean = opensOn.any { pattern ->
        if (pattern.endsWith(ANY)) omen.key.value.startsWith(pattern.dropLast(1)) else omen.key.value == pattern
    }

    override fun toString() = name

    companion object {
        private const val ANY = "*"

        /** Always open, and holding every action, so that a hand can always be dealt at every rarity. */
        val HEARTH = Pool("Hearth", emptyList())
    }
}

/** What dealing an action fills in from the moment: the words the player reads and what taking it does. */
data class Dealt(val label: String, val detail: String, val effect: Effect)

/**
 * One thing a choice roll can offer: a rarity, the pools it is in, and a way of dealing it from the moment and the
 * roll's omens. Dealing returns null when the action makes no sense now - gossip about the nearest house, when there
 * is none - and the hand is drawn without it. Made from the fate catalogue by [FateFromCatalogue], each kind of action
 * code the catalogue names.
 */
class Action(
    val id: String,
    val rarity: Rarity,
    val pools: Set<Pool>,
    val deal: (Moment, List<Omen>) -> Dealt?,
) {
    override fun toString() = id
}

/** What the fate engine deals from at a moment: the pools, and the actions in them. */
data class FateContent(val pools: List<Pool>, val actions: List<Action>)
