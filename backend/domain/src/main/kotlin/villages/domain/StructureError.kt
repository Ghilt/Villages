package villages.domain

/**
 * Everything a structure's rules can refuse, thrown from `decide`. One branch of [DomainError], beside [HouseError]
 * and [CharacterError]. See decision record 0093.
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

    /** The structure's type has no slot of that name. */
    class NoSuchSlot(slot: String) : StructureError("this structure has no slot called $slot")

    /** Every place of the slot is filled at the structure's level: something is taken out first. */
    class SlotFull(slot: String) : StructureError("the $slot is full")

    /** A content is in a structure's slots at most once. */
    data object AlreadyInSlot : StructureError("that is in this structure already")

    /** Taking out of a slot what is not in it. */
    data object NotInSlot : StructureError("that is not in that slot")

    class InvalidContent(reason: String) : StructureError("not something a slot can hold: $reason")

    /** Handing a structure to the holder it has changes nothing, so it is refused rather than written. */
    data object SameHolder : StructureError("it is held by them already")
}
