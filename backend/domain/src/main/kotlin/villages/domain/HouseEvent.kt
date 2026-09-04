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
 * A house was founded. The cell is computed here, once, so that routing, subscriptions and read models
 * downstream never recompute it. The treasury starts at nothing and begins to earn at the founding rate.
 */
data class HouseFounded(
    override val houseId: HouseId,
    val player: PlayerId,
    val name: HouseName,
    val seat: Location,
    val cell: Cell,
    val banner: Banner,
    val treasury: Treasury,
    override val at: Instant,
) : HouseEvent
