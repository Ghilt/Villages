package villages.domain

import java.util.UUID

/**
 * A decision put to a house: a prompt, and the few things it could do about it.
 *
 * One choice is pending on a house at a time, and it stays pending until an action takes one of its
 * options or a founding settles it. The interface shows it as a parchment and knows nothing else about
 * it: everything a player reads is in the words here, which is what lets a new kind of choice arrive
 * without touching the interface at all. See decision record 0034 and docs/MECHANICS.md.
 *
 * The choice is recorded whole on the event that gave it, options and effects and all, so the roads not
 * taken are history too and a reader of a stream can say what each would have done.
 */
data class Choice(
    val id: ChoiceId,
    /** What the world is asking, in the chronicle's voice. */
    val prompt: String,
    val options: List<Option>,
) {
    init {
        if (prompt.isBlank()) {
            throw HouseError.InvalidChoice("a choice has to ask something")
        }
        if (options.size !in FEWEST..MOST) {
            throw HouseError.InvalidChoice("a choice offers $FEWEST to $MOST options, not ${options.size}")
        }
        if (options.map(Option::id).distinct().size != options.size) {
            throw HouseError.InvalidChoice("two options of one choice share an id")
        }
    }

    /** The option with this id, or null when the choice does not offer it. */
    fun option(id: OptionId): Option? = options.firstOrNull { it.id == id }

    companion object {
        /** A choice with one option is not a choice. */
        const val FEWEST = 2

        /** More than this and the parchment is a menu, which the vision says the interface is not. */
        const val MOST = 4
    }
}

/**
 * One thing a choice offers: what it is called, a line saying more, and what taking it does.
 *
 * The label and the detail are content, written by whoever gave the choice. The effect is the part the
 * decider reads.
 */
data class Option(
    val id: OptionId,
    val label: String,
    val detail: String,
    val effect: Effect,
)

/**
 * What taking an option does, or reaching a line of a dialogue, as events.
 *
 * Sealed, so that the decider's branch over it is exhaustive and a new kind of effect cannot be added
 * without deciding what it records. Adding one is the whole cost of a new kind of choice: this, a branch
 * in `decide`, and a giver with the words. Choices and dialogues share it, so a new effect is one case for
 * both. See decision record 0067.
 */
sealed interface Effect {
    /** Found the house here, under this name and this banner. The first effect the world has. */
    data class FoundAt(
        val seat: Location,
        val name: HouseName,
        val banner: Banner,
    ) : Effect

    /**
     * Give the house some of a resource: what a line of a dialogue gives, and what an option can. Always more
     * than nothing, because a grant that could be refused would make a dialogue that gives it impassable.
     */
    data class Grant(val resource: Resource, val amount: Long) : Effect {
        init {
            if (amount <= 0) {
                throw HouseError.InvalidAmount("a grant is of more than nothing, and $amount is not")
            }
        }
    }
}

/** The identity of one choice, so that an action can only answer the choice it was given. */
@JvmInline
value class ChoiceId(val value: UUID)

/** The identity of one option within a choice. */
@JvmInline
value class OptionId(val value: UUID)
