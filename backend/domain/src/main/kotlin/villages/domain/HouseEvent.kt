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
