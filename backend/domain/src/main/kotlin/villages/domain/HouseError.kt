package villages.domain

/**
 * Everything the rules of the game can refuse, as one sealed hierarchy thrown from `decide` and from the
 * value types' own checks. See decision record 0013: no result type in the signatures, and the one place
 * that turns these into a rejection frame is the gateway.
 */
sealed class HouseError(message: String) : RuntimeException(message) {
    /** A house has one founding. */
    data object AlreadyFounded : HouseError("the house is already founded")

    class InvalidName(reason: String) : HouseError("not a house name: $reason")

    class InvalidLocation(reason: String) : HouseError("not a place in the world: $reason")

    class InvalidBanner(reason: String) : HouseError("not a banner: $reason")
}
