package villages.domain

/**
 * A portion of one resource tied to an undertaking for a span of months, and returned when it is up.
 *
 * Pledging is the third thing a resource can have done to it, after being granted and being spent, and it
 * is the only one that gives anything back. Reason and piety are what the fiction pledges; nothing in the
 * shape stops another resource being pledged, and nothing yet does.
 *
 * **A pledge is the only record of what is spoken for.** No stock carries a pledged total, because it
 * would be the sum of these and a second place for one fact to be wrong in. So releasing a pledge is
 * removing it from the list: there is no arithmetic to get wrong, and what is free goes back up by
 * itself.
 */
data class Pledge(
    val id: PledgeId,
    val resource: Resource,
    val amount: Long,
    /** The world-day it comes back on. Worked out from a span in months before it reaches the domain. */
    val until: WorldTime,
    /** What it is pledged to, in words. Free text until a mechanic gives the undertaking a shape. */
    val purpose: String,
) {
    init {
        require(amount > 0) { "a pledge is for more than nothing: $amount" }
        require(purpose.isNotBlank()) { "a pledge is for something" }
    }
}
