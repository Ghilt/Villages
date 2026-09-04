package villages.domain

import java.time.Instant

/** A request to change a house, named as an imperative. It may be rejected, and it is not stored. */
sealed interface HouseCommand {
    val houseId: HouseId
}

/** Found a house: give it a name, a seat on the map and a banner, at this instant. */
data class FoundHouse(
    override val houseId: HouseId,
    val player: PlayerId,
    val name: HouseName,
    val seat: Location,
    val banner: Banner,
    val at: Instant,
) : HouseCommand
