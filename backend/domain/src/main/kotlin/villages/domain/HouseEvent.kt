package villages.domain

import java.time.Instant

/**
 * An event kept on a house's stream, `house:<uuid>`: the consistency boundary a house's decisions are taken
 * inside. The name says which stream, not which kind. Whether it happened in the world or was done by a
 * player is the other question, answered by [WorldEvent] and [PlayerEvent], and the more interesting of the
 * two. See [Event].
 */
sealed interface HouseEvent : Event {
    val houseId: HouseId
}

/**
 * Something **a player did**, by which the world was reached into.
 *
 * Not a happening in the world: being asked something and answering it are the mechanics of play, and a
 * chronicler of the world would not write them down. They are recorded all the same, because they are
 * how everything in the world came to happen and because the house-spirit is a fold over them. Their
 * types read `villages.player.<verb>.v<n>`.
 *
 * This half stays small on purpose. If it grows as fast as the other, the game has become a menu.
 *
 * See decision record 0034.
 */
sealed interface PlayerEvent : HouseEvent

/**
 * A house's events come in families, one a mechanic: what it has, what it is asked, what it is told, whom it
 * holds, and what it sees. A family has nothing of its own. It is there so that a fold with nothing to say about
 * a mechanic passes the whole of it in one branch and stays exhaustive when the mechanic gains an event, and so
 * that a mechanic's events are in one place to be read. The founding is in none of them, because every mechanic
 * reads it. A new mechanic adds a family, and its events name it beside their half. See decision record 0075.
 */
sealed interface ResourceEvent : HouseEvent

/** A choice put to the house, and the option taken. See [ResourceEvent] for what a family is. */
sealed interface ChoiceEvent : HouseEvent

/** A dialogue offered, played, ended and lost. See [ResourceEvent] for what a family is. */
sealed interface DialogueEvent : HouseEvent

/** Whom the house holds. See [ResourceEvent] for what a family is. */
sealed interface KeyFigureEvent : HouseEvent

/** What the house is given to see, beyond its seat and its key figures. See [ResourceEvent] for what a family is. */
sealed interface VisionEvent : HouseEvent

/** Which of its holdings is the house's seat. See [ResourceEvent] for what a family is. */
sealed interface SeatEvent : HouseEvent

/**
 * A house named one of its holdings its seat: where the eye goes and the room is entered. Founding raises a castle
 * and the seats listener names it, in the founding's story. Only the id: what the structure is, is on its own stream.
 * See decision record 0093.
 */
data class HouseNamedSeat(
    override val houseId: HouseId,
    val structureId: StructureId,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : SeatEvent, WorldEvent

/**
 * A house lost its seat: the structure that was it changed hands or fell, and the house plays on without one. Its
 * sight from the seat ends with it. In the story of what took it. See decision record 0093.
 */
data class HouseLostSeat(
    override val houseId: HouseId,
    val structureId: StructureId,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : SeatEvent, WorldEvent

/**
 * A house was founded. It carries where, and how much that matters: those two are what put a thing on the
 * map, and which tile it falls in is worked out downstream from the first. It carries a stock of every
 * resource there was when it was written, all of them empty and none of them growing, because nothing
 * generates income yet; a resource added since is read as an empty one, `everyStock`. See decision records
 * 0026, 0006 and 0074.
 */
data class HouseFounded(
    override val houseId: HouseId,
    val player: PlayerId,
    val name: HouseName,
    val seat: Location,
    val significance: Significance,
    val banner: Banner,
    val resources: Map<Resource, Stock>,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : HouseEvent, WorldEvent

/** A house was given some of a resource. What gave it is the story around it, not a field on it. */
data class HouseResourceGranted(
    override val houseId: HouseId,
    val resource: Resource,
    val amount: Long,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : ResourceEvent, WorldEvent

/** Some of a house's resource was used up, and is gone. */
data class HouseResourceSpent(
    override val houseId: HouseId,
    val resource: Resource,
    val amount: Long,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : ResourceEvent, WorldEvent

/**
 * Some of a house's resource was tied to an undertaking until a world-day. It is not spent: it comes back
 * when the pledge is released, and until then it is not free for anything else.
 */
data class HouseResourcePledged(
    override val houseId: HouseId,
    val pledgeId: PledgeId,
    val resource: Resource,
    val amount: Long,
    val until: WorldTime,
    val purpose: String,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : ResourceEvent, WorldEvent

/**
 * A pledge ended and what it held is free again.
 *
 * Only the id is here. Which resource it was and how much is on the event that made the pledge, and
 * copying it would be two places for one fact to be wrong in - the same reason `PlayerTookAction` carries
 * ids and not the option.
 */
data class HouseResourceReleased(
    override val houseId: HouseId,
    val pledgeId: PledgeId,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : ResourceEvent, WorldEvent

/**
 * What one source pays the house changed: from now it pays these rates, by resource per second, and none for a
 * resource left out; empty when it stopped paying. Each stock it touches is brought up to now and runs on at the sum
 * of its sources. What the source is - a structure held, today - is the source's name; why it changed is the story
 * around it. See docs/plans/structures.md.
 */
data class HouseIncomeChanged(
    override val houseId: HouseId,
    val source: IncomeSource,
    val ratesPerSecond: Map<Resource, Double>,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : ResourceEvent, WorldEvent

/**
 * A player was given a choice to make. The whole choice is here, options and effects and all, so the
 * stream says what was offered and not only what was taken: the roads not taken are history too.
 *
 * Nothing happened in the world when this was written. The world is unchanged; a question was put.
 * See decision record 0034.
 */
data class PlayerGivenChoice(
    override val houseId: HouseId,
    val player: PlayerId,
    val choice: Choice,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : ChoiceEvent, PlayerEvent

/**
 * A player rolled: they pressed Take action, and the fate engine read these omens and rolled this rarity. The
 * price follows as the house's own spend and the hand as the choice given, from the same decision, so a hand is
 * never seen without its roll nor a roll without its price. The omens are history: the next roll's changes are
 * worked out against what the house had at this one, and they answer why a hand was what it was. See decision
 * record 0083.
 */
data class PlayerRolled(
    override val houseId: HouseId,
    val player: PlayerId,
    val rollId: RollId,
    val omens: List<Omen>,
    val rarity: Rarity,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : ChoiceEvent, PlayerEvent

/**
 * A player took one option of the choice they were given. What the option does follows from the same
 * decision, as the next events on the stream, so the action and its consequences are never seen apart.
 *
 * Only the two ids are here: what the option was is in the choice on the event that gave it, and copying
 * it would be two places for one fact to be wrong in.
 */
data class PlayerTookAction(
    override val houseId: HouseId,
    val player: PlayerId,
    val choiceId: ChoiceId,
    val optionId: OptionId,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : ChoiceEvent, PlayerEvent

/**
 * A player was offered a dialogue. The whole of it is here - the speakers, every line and every dialogue
 * choice, what each line does and what it requires - so the roads not taken are history too, as a choice's
 * are, and every later step is checked against this event alone. A house can have several open at once.
 *
 * Nothing happened in the world when this was written: a conversation was put to the house. See decision
 * record 0071.
 */
data class PlayerOfferedDialogue(
    override val houseId: HouseId,
    val player: PlayerId,
    val dialogue: Dialogue,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : DialogueEvent, PlayerEvent

/**
 * A player took a step through a dialogue: an option of a dialogue choice, or a line reached that has
 * an effect, is marked to be recorded, or ends it. Only the ids are here - the line is on the event that offered
 * the dialogue - and the plain lines read on the way are not recorded at all: every option taken is a step, so
 * the path can be rebuilt from the dialogue alone. What the line does follows as the world's own events, and
 * the end as `PlayerCompletedDialogue`, from the same decision. See decision record 0071.
 */
data class PlayerCompletedDialogueStep(
    override val houseId: HouseId,
    val player: PlayerId,
    val dialogueId: DialogueId,
    val lineId: LineId,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : DialogueEvent, PlayerEvent

/**
 * A player reached the end of a dialogue. Its own event, rather than a field on the last step, so that nothing
 * waiting on a dialogue's end has to look inside a step to find it; and not the event for a dialogue lost to a
 * requirement failing, so that nothing can take a loss for an end. See decision record 0071.
 */
data class PlayerCompletedDialogue(
    override val houseId: HouseId,
    val player: PlayerId,
    val dialogueId: DialogueId,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : DialogueEvent, PlayerEvent

/**
 * A dialogue lapsed before it was finished, because one of its requirements failed: a speaker died, say.
 * Its own event rather than an end with a reason, so that nothing waiting on a dialogue's end takes a loss for
 * one; `because` is the requirement, which is the one thing about them the player ever learns. It ends where
 * it stood, and it is no longer open. See decision record 0071.
 */
data class PlayerLostDialogue(
    override val houseId: HouseId,
    val player: PlayerId,
    val dialogueId: DialogueId,
    val because: Requirement,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : DialogueEvent, PlayerEvent

/**
 * A house took a character in as one of its key figures. A tie in the house's history, which the character's
 * own record never mentions: who they are is on their stream, and what they are to this house is here. See
 * decision record 0055.
 */
data class HouseGainedKeyFigure(
    override val houseId: HouseId,
    val characterId: CharacterId,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : KeyFigureEvent, WorldEvent

/**
 * A house lost one of its key figures. Why is the story it belongs to rather than a field on it: a loss that
 * follows a death carries the death's correlation, so the two read as one thing.
 */
data class HouseLostKeyFigure(
    override val houseId: HouseId,
    val characterId: CharacterId,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : KeyFigureEvent, WorldEvent

/**
 * A house was given vision of a place: it sees a circle about it, `radius` kilometres on the ground, from this
 * world-day until the vision is taken away. What gave it is the story it belongs to rather than a field on it.
 * The circle's size is on the event, so a later change to how far a house sees does not change what it was
 * given. It puts nothing on the map for anybody but the house, so it carries no significance. `from` is the
 * structure it is seen from, for what a holding gives its holder, or null for vision given outright: so that a
 * retuned catalogue never rewrites what a house saw, a structure's sight is written into the house's history as
 * this. See decision records 0061 and 0093.
 */
data class HouseGainedVision(
    override val houseId: HouseId,
    val visionId: VisionId,
    val place: Location,
    val radius: Double,
    val from: StructureId? = null,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : VisionEvent, WorldEvent

/** A house lost a vision it had been given. What the vision covered stays revealed. */
data class HouseLostVision(
    override val houseId: HouseId,
    val visionId: VisionId,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : VisionEvent, WorldEvent
