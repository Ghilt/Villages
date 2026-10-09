package villages.domain

/**
 * Everything a structure's rules can refuse, thrown from `decide`. One branch of [DomainError], beside [HouseError]
 * and [CharacterError]. See decision record 0092.
 */
sealed class StructureError(message: String) : DomainError(message) {
    /** A structure is raised once; raising a ruin again is rebuilding it. */
    data object AlreadyRaised : StructureError("this structure has been raised already")

    class NoSuchType(type: StructureType) : StructureError("the catalogue has no type of structure called $type")

    class InvalidLevel(reason: String) : StructureError("not a level: $reason")

    class InvalidName(reason: String) : StructureError("not a structure's name: $reason")
}
