package villages.application

import java.util.UUID

/**
 * Fresh identities, so that a use case can mint one without reaching for a random number generator and a
 * test can hand out a known one.
 *
 * What it makes is a message id, or the identity of something inside an aggregate such as a pledge. Never
 * an aggregate's own: those are derived, so that founding twice writes to one stream and is refused by the
 * decider rather than by a race. See decision record 0028.
 */
fun interface FreshIds {
    fun fresh(): UUID
}
