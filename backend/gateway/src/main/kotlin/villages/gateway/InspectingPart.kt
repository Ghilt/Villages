package villages.gateway

import villages.application.CharactersByCell
import villages.application.HouseById
import villages.application.WorldClock
import villages.domain.CharacterId
import villages.domain.HouseId
import villages.protocol.Inspect
import villages.protocol.Inspected
import java.util.UUID

/**
 * A window on a thing, answered wherever the camera is: the house or the character it asks after, as the map
 * would show it, once. A window is fed from the cells the camera holds, so one whose subject the camera has never
 * held asks here instead, and is answered by the same rule a cell's snapshot is: the day the connection is looking
 * at, and what its fog lets through. Nothing is kept of the asking and nothing is sent again, because what a
 * window shows rarely changes; when its subject comes into a held cell, the cell's own changes reach it. Somebody
 * the house saw once and does not see now is answered as they were last seen, and when the fog hid them. See
 * decision records 0087 and 0088.
 */
internal class InspectingPart(
    private val houses: HouseById,
    private val onTheMap: CharactersByCell,
    private val world: WorldClock,
) : Part {
    override fun register(commands: Commands, frames: Frames) {
        frames.on<Inspect> { connection, frame -> connection.out.send(answer(connection.looking, frame)) }
    }

    private fun answer(looking: Looking, asked: Inspect): Inspected {
        val nothing = Inspected(asked.kind, asked.id)
        // An id that is not one is a thing there is none of, and is answered so rather than refused.
        val id = runCatching { UUID.fromString(asked.id) }.getOrNull() ?: return nothing
        return when (asked.kind) {
            HOUSE -> houses.ofHouse(HouseId(id))
                ?.takeIf { looking.sees(it) && looking.letsSee(it) }
                ?.let { nothing.copy(house = it.toView()) }
            CHARACTER -> {
                val day = looking.day(world::today)
                if (!looking.fogged) {
                    onTheMap.standing(CharacterId(id), day)?.let { nothing.copy(character = it.row.toMapView(it.span)) }
                } else {
                    looking.fog.lastSeen(onTheMap.spansOf(CharacterId(id)), day)?.let { (seen, until) ->
                        nothing.copy(character = seen.row.toMapView(seen.span), seenUntil = until?.day)
                    }
                }
            }
            else -> null
        } ?: nothing
    }

    private companion object {
        const val HOUSE = "house"
        const val CHARACTER = "character"
    }
}
