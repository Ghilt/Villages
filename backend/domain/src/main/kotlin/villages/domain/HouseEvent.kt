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
 * A house was founded. It carries where, and how much that matters: those two are what put a thing on the
 * map, and which tile it falls in is worked out downstream from the first. It carries a stock of every
 * resource, all of them empty and none of them growing, because nothing generates income yet. See
 * decision records 0026 and 0006.
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
) : HouseEvent, WorldEvent {
    init {
        // A house has all five from the moment it exists, so nothing downstream has to ask whether it
        // happens to have one. A stored event that is missing one is malformed and says so here.
        require(resources.keys == Resource.entries.toSet()) {
            "a house is founded with a stock of every resource, not ${resources.keys}"
        }
    }
}

/** A house was given some of a resource. What gave it is the story around it, not a field on it. */
data class HouseResourceGranted(
    override val houseId: HouseId,
    val resource: Resource,
    val amount: Long,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : HouseEvent, WorldEvent

/** Some of a house's resource was used up, and is gone. */
data class HouseResourceSpent(
    override val houseId: HouseId,
    val resource: Resource,
    val amount: Long,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : HouseEvent, WorldEvent

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
) : HouseEvent, WorldEvent

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
) : HouseEvent, WorldEvent

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
) : PlayerEvent

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
) : PlayerEvent
