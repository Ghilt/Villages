package villages.domain

/**
 * Everything a house's rules can refuse, thrown from `decide` and from the value types a house is made of.
 * One branch of [DomainError], which is where a refusal that is no one kind of thing's lives.
 */
sealed class HouseError(message: String) : DomainError(message) {
    /** A house has one founding. */
    data object AlreadyFounded : HouseError("the house is already founded")

    class InvalidName(reason: String) : HouseError("not a house name: $reason")

    class InvalidBanner(reason: String) : HouseError("not a banner: $reason")

    class InvalidChoice(reason: String) : HouseError("not a choice: $reason")

    /** A house is asked one thing at a time, and this one has not been answered. */
    data object ChoicePending : HouseError("this house already has a choice to make")

    /** An action was taken on nothing: there is no choice open. */
    data object NoChoicePending : HouseError("this house has nothing to decide")

    /** An action answering a choice that is not the one pending, which is a stale parchment. */
    data object NoSuchChoice : HouseError("that is not the choice this house was given")

    /** An action taking an option the pending choice does not offer. */
    data object NoSuchOption : HouseError("that choice does not offer that option")
    data object NoSuchHouse : HouseError("there is no house here to do that to")
    data object NoSuchPledge : HouseError("this house has no such pledge")
    class InvalidAmount(reason: String) : HouseError("not an amount: $reason")
    class InvalidPledge(reason: String) : HouseError("not a pledge: $reason")

    /** A house acts through at most nine people. */
    data object TooManyKeyFigures : HouseError("this house already holds as many key figures as it can")

    data object AlreadyAKeyFigure : HouseError("that character is already one of this house's key figures")

    /** The character is not one of this house's key figures, which is also what acting through refuses with. */
    data object NoSuchKeyFigure : HouseError("that character is not one of this house's key figures")

    /** Not enough of a resource is free, whether because there is little or because much is pledged. */
    class NotEnoughFree(resource: Resource, wanted: Long, free: Long) :
        HouseError("this house has $free ${resource.name.lowercase()} free, not $wanted")
}
