package villages.domain

import java.time.Instant

/**
 * Something that happened to a house, in the past tense. Events are the only durable state and are never
 * edited or deleted. Every subclass has a row in docs/EVENTS.md, and a test fails when they disagree.
 */
sealed interface HouseEvent {
    val houseId: HouseId
    val at: Instant
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
    override val at: Instant,
) : HouseEvent
