package villages.domain

/**
 * Everything a character's rules can refuse, thrown from `decide` and from the value types a character is
 * made of. One branch of [DomainError], beside [HouseError].
 */
sealed class CharacterError(message: String) : DomainError(message) {
    /** A character appears once. */
    data object AlreadyAppeared : CharacterError("this character has already appeared")

    data object NoSuchCharacter : CharacterError("there is no such character to do that to")

    /** The dead do not change. */
    data object AlreadyDead : CharacterError("this character is dead")

    class InvalidName(reason: String) : CharacterError("not a character's name: $reason")

    class InvalidStat(reason: String) : CharacterError("not a stat: $reason")

    class InvalidAge(reason: String) : CharacterError("not an age: $reason")

    class InvalidPortrait(reason: String) : CharacterError("not a portrait: $reason")

    class InvalidCause(reason: String) : CharacterError("not a cause of death: $reason")
}
