package villages.domain

import java.time.Instant

/**
 * The state of one house, folded from its events.
 *
 * Both states carry the choice pending on the house, because a house is asked things before it exists:
 * where to found itself is the first of them. See decision record 0034.
 */
sealed interface House {
    /** The choice this house has to make, or null when it has none. */
    val pending: Choice?

    /** Nothing founded yet: the state every stream starts in, and a house can be asked things in it. */
    data class NotFounded(override val pending: Choice? = null) : House

    data class Founded(
        val id: HouseId,
        val player: PlayerId,
        val name: HouseName,
        val seat: Location,
        val significance: Significance,
        val banner: Banner,
        /** One stock of every resource. A house always has all five, even when they are nothing. */
        val resources: Map<Resource, Stock>,
        /** What is spoken for, and the only record of it. See `Pledge`. */
        val pledges: List<Pledge> = emptyList(),
        /**
         * The characters this house acts through, in the order it took them in: a tie in the house's own
         * history, never in theirs. At most nine. See decision record 0055.
         */
        val keyFigures: List<CharacterId> = emptyList(),
        /** The visions this house was given outright and still has, in the order it was given them. */
        val visions: List<VisionId> = emptyList(),
        /**
         * The dialogues this house was offered and has not finished, in the order it was offered them, each with
         * the steps it has taken through it. A finished one leaves the list. See decision record 0067.
         */
        val openDialogues: List<OpenDialogue> = emptyList(),
        /** Every dialogue it was ever offered, open or over, so that the same offer twice is refused. */
        val offeredDialogues: Set<DialogueId> = emptySet(),
        /** The world-day it was founded on, and the instant that was recorded. */
        val foundedOn: WorldTime,
        val foundedAt: Instant,
        override val pending: Choice? = null,
    ) : House {
        /** What this house has of one resource. A founded house has all five, so this never misses. */
        fun stockOf(resource: Resource): Stock = resources.getValue(resource)

        /** How much of one resource is spoken for: the sum of the live pledges against it, and nothing stored. */
        fun pledgedOf(resource: Resource): Long =
            pledges.filter { it.resource == resource }.sumOf { it.amount }

        /**
         * How much of one resource the house may actually do something with: what it has now, less what is
         * pledged. Every rule that asks whether a house can afford or attempt a thing asks this.
         */
        fun freeOf(resource: Resource, now: Instant): Long = stockOf(resource).at(now) - pledgedOf(resource)

        /**
         * Whether the house has enough of a resource free to be allowed something. **The gate**, which is
         * what domain and influence are for: it reads, and takes nothing. Nothing calls it yet, because
         * there is nothing to build; it is here because a gate that is a question and not a subtraction is
         * the whole distinction between those two resources and wealth.
         */
        fun has(resource: Resource, wanted: Long, now: Instant): Boolean = freeOf(resource, now) >= wanted

        /** The house with one of its stocks changed. */
        internal fun withStock(resource: Resource, change: (Stock) -> Stock): Founded =
            copy(resources = resources + (resource to change(stockOf(resource))))
    }
}
