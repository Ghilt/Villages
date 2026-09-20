package villages.domain

import java.time.Instant

/**
 * Something that happened on a house's stream, in the past tense. Events are the only durable state and
 * are never edited or deleted. Every subclass has a row in docs/EVENTS.md, and a test fails when they
 * disagree.
 *
 * The name says which stream, not which kind: everything here is addressed as `house:<uuid>`, because
 * that is the consistency boundary a decision is taken inside. What kind of thing happened is the two
 * sealed halves below, and it is the more interesting question of the two.
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
 * Something that happened **in the world**: a thing came to be, moved, changed or ended.
 *
 * This is the half that grows. Every feature that puts something on the map or changes what is there
 * adds to it, and its events are what the chronicle is made of and what the map is drawn from. Their
 * types read `villages.house.<verb>.v<n>`, after the thing whose history they are.
 *
 * See decision record 0034.
 */
sealed interface WorldEvent : HouseEvent

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
) : WorldEvent {
    init {
        // A house has all five from the moment it exists, so nothing downstream has to ask whether it
        // happens to have one. A stored event that is missing one is malformed and says so here.
        require(resources.keys == Resource.entries.toSet()) {
            "a house is founded with a stock of every resource, not ${resources.keys}"
        }
    }
}

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
