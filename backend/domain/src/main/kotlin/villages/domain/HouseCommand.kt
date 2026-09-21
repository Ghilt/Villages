package villages.domain

import java.time.Instant

/** A request to change a house, named as an imperative. It may be rejected, and it is not stored. */
sealed interface HouseCommand {
    val houseId: HouseId
}

/** Found a house: give it a name, a seat on the map and a banner, on this world-day, recorded now. */
/** A house was given some of a resource, from wherever the world gives things from. */
data class GrantResource(
    override val houseId: HouseId,
    val resource: Resource,
    val amount: Long,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : HouseCommand

/** Some of a resource is used up. Refused unless that much of it is free. */
data class SpendResource(
    override val houseId: HouseId,
    val resource: Resource,
    val amount: Long,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : HouseCommand

/**
 * Some of a resource is tied to an undertaking until a world-day.
 *
 * The day is worked out before the command is made, from a span in months, because the calendar lives in
 * `protocol` and the domain may not see it. See decision record 0051.
 */
data class PledgeResource(
    override val houseId: HouseId,
    val pledgeId: PledgeId,
    val resource: Resource,
    val amount: Long,
    val until: WorldTime,
    val purpose: String,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : HouseCommand

/**
 * A pledge ends and what it held comes back.
 *
 * One command for both ways it can happen: the span running out, and somebody ending it early. The
 * domain records that it ended; whose idea it was, and whether ending early should cost something, is a
 * mechanic and not the shape.
 */
data class ReleasePledge(
    override val houseId: HouseId,
    val pledgeId: PledgeId,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : HouseCommand

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
