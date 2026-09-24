package villages.domain

/**
 * Everything the rules of the game can refuse, as one sealed hierarchy thrown from `decide` and from the
 * value types' own checks. See decision record 0013: no result type in the signatures, and the one place
 * that turns these into a rejection frame is the gateway.
 *
 * Each kind of thing refuses in its own words - a house's rules are [HouseError] - and what belongs to no
 * one kind of thing is here at the root. A place is a place whatever stands on it, so a house's seat and
 * anything else put on the map refuse a bad one the same way. See decision record 0055.
 */
sealed class DomainError(message: String) : RuntimeException(message) {
    class InvalidLocation(reason: String) : DomainError("not a place in the world: $reason")
}
