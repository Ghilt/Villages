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
        /** The world-day it was founded on, and the instant that was recorded. */
        val foundedOn: WorldTime,
        val foundedAt: Instant,
        override val pending: Choice? = null,
    ) : House {
        /** What this house has of one resource. A founded house has all five, so this never misses. */
        fun stockOf(resource: Resource): Stock = resources.getValue(resource)
    }
}
