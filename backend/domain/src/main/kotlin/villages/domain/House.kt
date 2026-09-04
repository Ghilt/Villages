package villages.domain

import java.time.Instant

/** The state of one house, folded from its events. */
sealed interface House {
    /** No events yet: the state every stream starts in. */
    data object NotFounded : House

    data class Founded(
        val id: HouseId,
        val player: PlayerId,
        val name: HouseName,
        val seat: Location,
        val cell: Cell,
        val banner: Banner,
        val treasury: Treasury,
        val foundedAt: Instant,
    ) : House
}
