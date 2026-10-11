package villages.domain

import java.time.Instant

/** A request to change a house, named as an imperative. It may be rejected, and it is not stored. */
sealed interface HouseCommand {
    val houseId: HouseId
}

/**
 * A house's commands come in the same families as its events, one a mechanic, so that the decider hands a whole
 * family to the part of the house that decides it: what it has, what it is asked, what it is told, whom it holds,
 * and what it sees. The founding is in none, as its event is in none. See decision record 0075.
 */
sealed interface ResourceCommand : HouseCommand

/** A choice put to the house, and an option of it taken. See [ResourceCommand] for what a family is. */
sealed interface ChoiceCommand : HouseCommand

/** A dialogue offered, a step taken through it, and a requirement it needed failing. See [ResourceCommand]. */
sealed interface DialogueCommand : HouseCommand

/** Whom the house holds, and the two questions that can only be refused. See [ResourceCommand]. */
sealed interface KeyFigureCommand : HouseCommand

/** A vision given outright, and taken away. See [ResourceCommand] for what a family is. */
sealed interface VisionCommand : HouseCommand

/** Which of its holdings is the house's seat. See [ResourceCommand] for what a family is. */
sealed interface SeatCommand : HouseCommand

/**
 * Name a structure the house's seat: the role one of its holdings plays, where the eye goes and the room is entered.
 * Sent by the seats listener for the castle founding raises. Refused for a house that has named its seat before,
 * so a founding heard again names nothing twice. See decision record 0093.
 */
data class NameSeat(
    override val houseId: HouseId,
    val structureId: StructureId,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : SeatCommand

/**
 * The house's seat is no longer its: the structure changed hands or fell. Sent by the seats listener. Refused for a
 * structure that is not the house's seat, so a loss heard again writes nothing. See decision record 0093.
 */
data class LoseSeat(
    override val houseId: HouseId,
    val structureId: StructureId,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : SeatCommand

/** A house was given some of a resource, from wherever the world gives things from. */
data class GrantResource(
    override val houseId: HouseId,
    val resource: Resource,
    val amount: Long,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : ResourceCommand

/** Some of a resource is used up. Refused unless that much of it is free. */
data class SpendResource(
    override val houseId: HouseId,
    val resource: Resource,
    val amount: Long,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : ResourceCommand

/**
 * Some of a resource is tied to an undertaking until a world-day.
 *
 * The day is worked out before the command is made, from a span in months, because the calendar lives in
 * `protocol` and the domain may not see it. See decision record 0053.
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
) : ResourceCommand

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
) : ResourceCommand

/**
 * What one source pays the house from now, by resource per second; nothing, or only zeros, to stop it paying. Sent
 * by the standing-effects listener for a structure the house holds. The same rates again write nothing, so a
 * reconciliation run twice is harmless. See docs/plans/structures.md.
 */
data class SetIncome(
    override val houseId: HouseId,
    val source: IncomeSource,
    val ratesPerSecond: Map<Resource, Double>,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : ResourceCommand

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
) : ChoiceCommand

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
) : ChoiceCommand

/**
 * Roll for this house: the player pressed Take action. Everything the fate engine worked out comes with it - the
 * omens it read, the rarity it rolled, the price, and the hand it dealt - because the luck is the application's
 * and `decide` only checks and records. Refused before founding, while a choice is pending, and when the price
 * is not free. See decision record 0083.
 */
data class Roll(
    override val houseId: HouseId,
    val player: PlayerId,
    val rollId: RollId,
    val omens: List<Omen>,
    val rarity: Rarity,
    val price: Effect.Spend,
    val hand: Choice,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : ChoiceCommand

/**
 * Offer this house a dialogue, whole. Refused for a house that does not exist, and for a dialogue it was
 * offered before: the id is worked out from the command that offered it, so the same command sent twice is
 * refused rather than doubled. Who it reaches is the house's player. See decision record 0071.
 */
data class OfferDialogue(
    override val houseId: HouseId,
    val dialogue: Dialogue,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : DialogueCommand

/**
 * Take one step through a dialogue the house has open: an option of the dialogue choice pending, or the line the
 * stretch being read ends in. Anything else is refused, which is what pays a line's reward once on every path.
 * What the line does, and the end when it ends the dialogue, follow from the same decision. See decision
 * record 0071.
 */
data class CompleteDialogueStep(
    override val houseId: HouseId,
    val dialogueId: DialogueId,
    val lineId: LineId,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : DialogueCommand

/**
 * A requirement has failed for good: every open dialogue of this house that needed it lapses, in one decision,
 * and a failure that touches none of them writes nothing, so a replay does no harm. Sent by whatever heard the
 * event that broke it; what the failure ends is the house's own rule. See decision record 0071.
 */
data class FailRequirement(
    override val houseId: HouseId,
    val requirement: Requirement,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : DialogueCommand

/**
 * Give the house vision of a place, outright: it sees a circle about the place from this world-day until the
 * vision is taken away. The debug panel's lever, what a storyline giving sight of a far coast will issue, and what
 * a structure gives its holder, `from` it, at the radius its type and level see: the catalogue's to say, which the
 * house's rules cannot read, so the command carries it. See decision records 0061 and 0093.
 */
data class GiveVision(
    override val houseId: HouseId,
    val visionId: VisionId,
    val place: Location,
    val worldTime: WorldTime,
    val recordedAt: Instant,
    /** How far it sees, in kilometres: a seat's unless a structure's type and level say otherwise. */
    val radius: Double = Vision.MALLORCA,
    /** The structure it is seen from, or null for vision given outright. */
    val from: StructureId? = null,
) : VisionCommand

/** Take away a vision the house was given. Refused for one it does not have. */
data class TakeVision(
    override val houseId: HouseId,
    val visionId: VisionId,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : VisionCommand

/** Take a character in as one of the house's key figures. Refused for a tenth, or for someone already held. */
data class TakeKeyFigure(
    override val houseId: HouseId,
    val characterId: CharacterId,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : KeyFigureCommand

/** Lose one of the house's key figures. Refused for anybody the house does not hold. */
data class LoseKeyFigure(
    override val houseId: HouseId,
    val characterId: CharacterId,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : KeyFigureCommand

/**
 * Act through one of the house's key figures: a command that can only be refused. Nothing happens to the
 * house, so nothing is written when the character is one of its own, and it is refused `NoSuchKeyFigure`
 * when they are not. That is how a lever naming a character is decided against the house's own history
 * before it touches the character's stream. See decision record 0055.
 */
data class ActThrough(
    override val houseId: HouseId,
    val characterId: CharacterId,
) : KeyFigureCommand

/**
 * Ask whether the house has room for another key figure before anybody is brought in to fill it: a command
 * that can only be refused, as `ActThrough` is. Refused `TooManyKeyFigures` when all nine places are taken.
 */
data class CheckRoomForKeyFigure(
    override val houseId: HouseId,
) : KeyFigureCommand
