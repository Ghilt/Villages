package villages.application.fate

import villages.domain.Location

/**
 * The river a player points at: whether the master's ground map has one where they clicked, and which it is where the
 * master's real names were carried - the nearest named river close enough to be the one painted there, as the map's
 * omens find it. Whether the house may know is not asked here: that is the gateway's to say, from its fog. What an
 * inspect window on a river shows. See decision record 0087.
 */
class RiverAt(private val grounds: GroundMaps, private val names: PlaceNamesByMaster) {
    /** The river at [place] on [master], or null where its ground has none; its name null where none is near. */
    fun at(master: String, place: Location): RiverHere? {
        val ground = grounds.of(master) ?: return null
        if (!ground.at(place).has(GroundMap.RIVER)) {
            return null
        }
        return RiverHere(names.of(master)?.near(NameKind.RIVER, place, MapOmens.RIVER_REACH_KM)?.firstOrNull()?.name)
    }

    companion object {
        /** A world with no ground maps, where nothing is a river. */
        val NOWHERE = RiverAt({ null }, { null })
    }
}

/** A river pointed at, and the named river it is where one is known. */
data class RiverHere(val name: PlaceName?)
