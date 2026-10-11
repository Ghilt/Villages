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

    /**
     * A house that stands: who it is, and a part for each mechanic on its stream, each deciding its own family
     * of commands and folding its own family of events. The choice pending stays on the house, because an
     * unfounded house has one too. See decision record 0075.
     */
    data class Founded(
        val id: HouseId,
        val player: PlayerId,
        val name: HouseName,
        val seat: Location,
        val significance: Significance,
        val banner: Banner,
        /** What it has. */
        val treasury: Treasury,
        /** Whom it holds. */
        val figures: KeyFigures = KeyFigures(),
        /** What it was given to see outright. */
        val vision: Visions = Visions(),
        /** What it was told. */
        val dialogues: Dialogues = Dialogues(),
        /** Which of its holdings is its seat. */
        val seating: Seating = Seating(),
        /** The world-day it was founded on, and the instant that was recorded. */
        val foundedOn: WorldTime,
        val foundedAt: Instant,
        override val pending: Choice? = null,
    ) : House {
        // What the parts hold, asked of the house: whatever reads a house asks the house, never its parts.

        /** One stock of every resource. A house always has all five, even when they are nothing. */
        val resources: Map<Resource, Stock> get() = treasury.resources

        /** What is spoken for, and the only record of it. See `Pledge`. */
        val pledges: List<Pledge> get() = treasury.pledges

        /** The characters this house acts through, in the order it took them in. At most nine. See 0055. */
        val keyFigures: List<CharacterId> get() = figures.held

        /** The visions this house was given outright and still has, in the order it was given them. */
        val visions: List<VisionId> get() = vision.given

        /** The holding that is its seat, or null for a house that has none. See 0092. */
        val seatedIn: StructureId? get() = seating.structure

        /** The dialogues this house was offered and has not finished, each with the steps taken. See 0071. */
        val openDialogues: List<OpenDialogue> get() = dialogues.open

        /** Every dialogue it was ever offered, open or over. */
        val offeredDialogues: Set<DialogueId> get() = dialogues.offered

        /** What this house has of one resource. See [Treasury.stockOf]. */
        fun stockOf(resource: Resource): Stock = treasury.stockOf(resource)

        /** How much of one resource is spoken for. See [Treasury.pledgedOf]. */
        fun pledgedOf(resource: Resource): Long = treasury.pledgedOf(resource)

        /** How much of one resource the house may do something with. See [Treasury.freeOf]. */
        fun freeOf(resource: Resource, now: Instant): Long = treasury.freeOf(resource, now)

        /** Whether the house has enough of a resource free to be allowed something. See [Treasury.has]. */
        fun has(resource: Resource, wanted: Long, now: Instant): Boolean = treasury.has(resource, wanted, now)
    }
}
