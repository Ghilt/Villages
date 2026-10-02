package villages.domain

import java.time.Instant

/**
 * Something that happened, in the past tense. Events are the only durable state and are never edited or
 * deleted. Every one has a row in docs/EVENTS.md, and a test fails when they disagree.
 *
 * Two questions are asked of every event, and the hierarchy answers each of them once. **Where it is kept**
 * is the stream it belongs to, the consistency boundary a decision is taken inside: a house's are
 * [HouseEvent]s. **What kind of thing happened** is the two halves, [WorldEvent] and [PlayerEvent]. So an
 * event of the world on a house's stream is both a [HouseEvent] and a [WorldEvent], and a new kind of stream
 * adds a sibling to [HouseEvent] without touching either half. See decision records 0034 and 0055. A third
 * question is asked of a house's: **which mechanic it belongs to**, which is its family, [ResourceEvent] and its
 * siblings, so that a fold can pass a whole mechanic in one branch. See decision record 0075.
 *
 * Every event carries two times, because they can differ: when it happened in the world's own calendar,
 * and when it was written down by the clock on the wall. See decision record 0027.
 */
sealed interface Event {
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
 * types read `villages.<whose>.<verb>.v<n>`, after the thing whose history they are: `villages.house.` for
 * a house's.
 *
 * See decision record 0034.
 */
sealed interface WorldEvent : Event
