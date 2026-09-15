package villages.domain

import java.time.Instant

/** A request to change a house, named as an imperative. It may be rejected, and it is not stored. */
sealed interface HouseCommand {
    val houseId: HouseId
}

/** Found a house: give it a name, a seat on the map and a banner, on this world-day, recorded now. */
data class FoundHouse(
    override val houseId: HouseId,
    val player: PlayerId,
    val name: HouseName,
    val seat: Location,
    val banner: Banner,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : HouseCommand

/**
 * Put a choice to this house. Refused while it already has one to make, so that a player is asked one
 * thing at a time. Issued by whatever decided the choice applies, which today is arrival.
 */
data class GiveChoice(
    override val houseId: HouseId,
    val player: PlayerId,
    val choice: Choice,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : HouseCommand

/**
 * Take one option of the choice this house was given. It names the choice as well as the option, so that
 * a parchment left open while the world moved on is refused rather than answering something else.
 */
data class TakeAction(
    override val houseId: HouseId,
    val player: PlayerId,
    val choiceId: ChoiceId,
    val optionId: OptionId,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : HouseCommand
