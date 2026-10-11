package villages.gateway

import villages.protocol.CharacterArrived
import villages.protocol.CharacterChanged
import villages.protocol.CharacterGone
import villages.protocol.Delta
import villages.protocol.HouseAppeared
import villages.protocol.HouseChanged
import villages.protocol.StructureArrived
import villages.protocol.StructureChanged

/** What makes two deltas the same one: the thing they are about and its version. */
internal val Delta.key: Pair<String, Long>
    get() = when (this) {
        is HouseAppeared -> house.id to house.version
        is HouseChanged -> house.id to house.version
        is CharacterArrived -> "character:${character.id}" to character.version
        is CharacterChanged -> "character:${character.id}" to character.version
        is CharacterGone -> "character:$id" to version
        is StructureArrived -> "structure:${structure.id}" to structure.stamp
        is StructureChanged -> "structure:${structure.id}" to structure.stamp
    }
