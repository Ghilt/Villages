package villages.application.fate

import villages.application.Balance
import villages.application.Dice
import villages.application.FreshIds
import villages.domain.Choice
import villages.domain.ChoiceId
import villages.domain.Omen
import villages.domain.OmenKey
import villages.domain.Option
import villages.domain.OptionId
import villages.domain.Rarity

/** One action that could have been dealt, and how heavily: the number of open pools it is in. */
data class Considered(val action: String, val weight: Int)

/**
 * What one roll came to, before it is recorded: the omens read, the rarity rolled, the hand dealt, and - for the
 * debug panel and nothing else - which pools opened and what was in the draw.
 */
data class Rolled(
    val omens: List<Omen>,
    val rarity: Rarity,
    val hand: Choice,
    val opened: List<String>,
    val considered: List<Considered>,
)

/**
 * The fate engine: it reads the omens, rolls a rarity, opens the pools the omens point at, and deals a hand of
 * actions from them. All the luck is here, before the command; `decide` only checks and records what this dealt.
 * The odds - chance out of a hundred of each rarity, the same for everyone, which omens never move - and how many
 * options a hand deals are the balance's, read at each roll. See `ARCHITECTURE.md` and decision records 0083 and 0097.
 */
class FateEngine(
    private val sources: List<OmenSource>,
    /** The pools and the actions in force, read at each roll: the fate catalogue's, which a retune changes. */
    private val content: () -> FateContent,
    private val dice: Dice,
    private val ids: FreshIds,
    private val balance: () -> Balance,
) {
    /** Deals from these pools and actions for good: a test's. */
    constructor(sources: List<OmenSource>, pools: List<Pool>, actions: List<Action>, dice: Dice, ids: FreshIds, balance: () -> Balance) :
        this(sources, { FateContent(pools, actions) }, dice, ids, balance)

    /** Rolls for a house at a moment. `rarity` stands in for the world's luck, from the debug panel's lever. */
    fun roll(moment: Moment, rarity: Rarity? = null): Rolled {
        val omens = sources.flatMap { it.read(moment) }.distinctBy(Omen::key)
        val (pools, actions) = content()
        val opened = listOf(Pool.HEARTH) + pools.filter { pool -> pool != Pool.HEARTH && omens.any(pool::opensOn) }
        val numbers = balance().roll
        val rolled = rarity ?: rarityFrom(dice.roll(numbers.odds.values.sum()), numbers.odds)

        // A rarity with too little that can be dealt now falls to the one below it, so a hand is always one
        // rarity and always a choice. The content checks keep Hearth deep enough that this is never reached.
        var at = rolled
        var draw = drawable(actions, at, moment, omens, opened)
        while (draw.size < Choice.FEWEST && at != Rarity.COMMON) {
            at = Rarity.entries[at.ordinal - 1]
            draw = drawable(actions, at, moment, omens, opened)
        }
        check(draw.size >= Choice.FEWEST) { "fewer than ${Choice.FEWEST} common actions can be dealt" }

        val picked = pick(draw, opened, numbers.hand)
        val hand = Choice(
            id = ChoiceId(ids.fresh()),
            prompt = PROMPT,
            options = picked.map { (action, dealt) ->
                Option(
                    id = OptionId(ids.fresh()),
                    label = dealt.label,
                    detail = dealt.detail,
                    effect = dealt.effect,
                    rarity = at,
                    omens = broughtBy(action, omens, opened),
                )
            },
        )
        return Rolled(omens, at, hand, opened.map(Pool::name), draw.map { (action, _) -> Considered(action.id, weightOf(action, opened)) })
    }

    private fun drawable(actions: List<Action>, rarity: Rarity, moment: Moment, omens: List<Omen>, opened: List<Pool>): List<Pair<Action, Dealt>> =
        actions
            .filter { it.rarity == rarity && it.pools.any(opened::contains) }
            .mapNotNull { action -> action.deal(moment, omens)?.let { action to it } }

    /** Draws `count` without putting back, each in proportion to how many open pools it is in. */
    private fun pick(draw: List<Pair<Action, Dealt>>, opened: List<Pool>, count: Int): List<Pair<Action, Dealt>> {
        val left = draw.toMutableList()
        return List(minOf(count, draw.size)) {
            var at = dice.roll(left.sumOf { (action, _) -> weightOf(action, opened) })
            val chosen = left.first { (action, _) ->
                at -= weightOf(action, opened)
                at <= 0
            }
            left.remove(chosen)
            chosen
        }
    }

    private fun weightOf(action: Action, opened: List<Pool>): Int = action.pools.count(opened::contains)

    /** The omens that opened one of the action's pools, Hearth aside: the marks the player sees on its option. */
    private fun broughtBy(action: Action, omens: List<Omen>, opened: List<Pool>): List<OmenKey> =
        omens.filter { omen -> action.pools.any { it != Pool.HEARTH && it in opened && it.opensOn(omen) } }.map(Omen::key)

    companion object {
        const val PROMPT = "What will the house do?"

        /** A rarity from a throw of one to a hundred, in the order of [odds]: the most common first. */
        fun rarityFrom(throwOfHundred: Int, odds: Map<Rarity, Int>): Rarity {
            var left = throwOfHundred
            for (rarity in Rarity.entries) {
                val chance = odds[rarity] ?: 0
                if (left <= chance) return rarity
                left -= chance
            }
            return Rarity.LEGENDARY
        }
    }
}
