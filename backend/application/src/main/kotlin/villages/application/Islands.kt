package villages.application

import villages.domain.Location

/**
 * Whether a place stands on an island in the world being played: on land smaller than the smallest continent. What a
 * quest's objective asks of where a structure stands. False on a continent and on water, and false where the world's
 * ground is not known, because an island nobody can see is not one to tick. See decision record 0096.
 */
fun interface Islands {
    fun onAnIsland(place: Location): Boolean

    companion object {
        /** Ground nobody knows: nowhere is an island. */
        val NOWHERE = Islands { false }
    }
}
