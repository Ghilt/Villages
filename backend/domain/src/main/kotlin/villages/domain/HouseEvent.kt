package villages.domain

import java.time.Instant

/**
 * Something that happened to a house, in the past tense. Events are the only durable state and are never
 * edited or deleted. Every subclass has a row in docs/EVENTS.md, and a test fails when they disagree.
 *
 * Every event carries two times, because they can differ: when it happened in the world's own calendar,
 * and when it was written down by the clock on the wall. Playing the past appends an event now whose
 * world-time is centuries ago. See decision record 0027.
 */
sealed interface HouseEvent {
    val houseId: HouseId

    /** When it happened, in the world's calendar. What the map at a moment and the scrubber order by. */
    val worldTime: WorldTime

    /** When it was recorded, by the server's clock. The store's own order, and the house-spirit's. */
    val recordedAt: Instant
}

/**
 * A house was founded. It carries where, and how much that matters: those two are what put a thing on the
 * map, and which tile it falls in is worked out downstream from the first. The treasury starts at nothing
 * and begins to earn at the founding rate. See decision record 0026.
 */
data class HouseFounded(
    override val houseId: HouseId,
    val player: PlayerId,
    val name: HouseName,
    val seat: Location,
    val significance: Significance,
    val banner: Banner,
    val treasury: Treasury,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : HouseEvent

/**
 * A house was given a choice to make. The whole choice is here, options and effects and all, so the
 * stream says what was offered and not only what was taken: the roads not taken are history too.
 *
 * Nothing is on the map yet, so this carries no place and no significance. See decision record 0034.
 */
data class HouseGivenChoice(
    override val houseId: HouseId,
    val player: PlayerId,
    val choice: Choice,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : HouseEvent

/**
 * A house took one option of the choice it was given. What the option does follows from the same
 * decision, as the next events on the stream, so the action and its consequence are never seen apart.
 *
 * Only the two ids are here: what the option was is in the choice on the event that gave it, and copying
 * it would be two places for one fact to be wrong in.
 */
data class HouseTookAction(
    override val houseId: HouseId,
    val player: PlayerId,
    val choiceId: ChoiceId,
    val optionId: OptionId,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : HouseEvent
