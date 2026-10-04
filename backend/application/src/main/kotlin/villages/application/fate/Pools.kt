package villages.application.fate

import villages.domain.Effect
import villages.domain.Omen
import villages.domain.Rarity

/**
 * A named grouping of actions, opened by omens. The game's own filing and never shown to the player, so pools can
 * be reorganised without anybody noticing. An action in more open pools is likelier to be dealt.
 */
class Pool(val name: String, private val opens: (Omen) -> Boolean) {
    fun opensOn(omen: Omen): Boolean = opens(omen)

    override fun toString() = name

    companion object {
        /** Always open, and holding every action, so that a hand can always be dealt at every rarity. */
        val HEARTH = Pool("Hearth") { false }
    }
}

/** What dealing an action fills in from the moment: the words the player reads and what taking it does. */
data class Dealt(val label: String, val detail: String, val effect: Effect)

/**
 * One thing a choice roll can offer: a rarity, the pools it is in, and a way of dealing it from the moment and the
 * roll's omens. Dealing returns null when the action makes no sense now - gossip about the nearest house, when there
 * is none - and the hand is drawn without it. Written in Kotlin beside the engine, so a dealt action is code and can
 * read the world.
 */
class Action(
    val id: String,
    val rarity: Rarity,
    val pools: Set<Pool>,
    val deal: (Moment, List<Omen>) -> Dealt?,
) {
    override fun toString() = id
}
