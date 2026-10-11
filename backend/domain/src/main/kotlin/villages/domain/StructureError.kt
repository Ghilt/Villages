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

    /** Nothing can be done to a structure that was never raised. */
    data object NoSuchStructure : StructureError("there is no such structure")

    /** A ruin cannot change hands, change its level or fall again: it is rebuilt first. */
    data object IsARuin : StructureError("it is a ruin")

    /** Only a ruin is rebuilt; a structure standing is not. */
    data object NotARuin : StructureError("it is not a ruin")

    /** Handing a structure to the holder it has changes nothing, so it is refused rather than written. */
    data object SameHolder : StructureError("it is held by them already")
}
