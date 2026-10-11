package villages.gateway

import villages.application.CharactersByCell
import villages.application.HouseById
import villages.application.StructuresByCell
import villages.application.WorldClock
import villages.domain.CharacterId
import villages.domain.HouseId
import villages.domain.StructureId
import villages.protocol.Inspect
import villages.protocol.Inspected
import java.util.UUID

/**
 * A window on a thing, answered wherever the camera is: the house, the character or the structure it asks after, as
 * the map would show it, once. A window is fed from the cells the camera holds, so one whose subject the camera has never
 * held asks here instead, and is answered by the same rule a cell's snapshot is: the day the connection is looking
 * at, and what its fog lets through. Nothing is kept of the asking and nothing is sent again, because what a
 * window shows rarely changes; when its subject comes into a held cell, the cell's own changes reach it. Somebody
 * the house saw once and does not see now is answered as they were last seen, and a house or a person the fog has
 * hidden with the day it did, as a cell sends a house. See decision records 0088 and 0089.
 */
internal class InspectingPart(
    private val houses: HouseById,
    private val onTheMap: CharactersByCell,
    private val structures: StructuresByCell,
    private val world: WorldClock,
) : Part {
    override fun register(commands: Commands, frames: Frames) {
        frames.on<Inspect> { connection, frame -> connection.out.send(answer(connection.looking, frame)) }
    }

    private fun answer(looking: Looking, asked: Inspect): Inspected {
        val nothing = Inspected(asked.kind, asked.id)
        // An id that is not one is a thing there is none of, and is answered so rather than refused.
        val id = runCatching { UUID.fromString(asked.id) }.getOrNull() ?: return nothing
        val day = looking.day(world::today)
        return when (asked.kind) {
            HOUSE -> houses.ofHouse(HouseId(id))
                ?.takeIf { looking.sees(it) }
                ?.let { looking.sent(it, day) }
                ?.let { nothing.copy(house = it) }
            CHARACTER -> {
                if (!looking.fogged) {
                    onTheMap.standing(CharacterId(id), day)?.let { nothing.copy(character = it.row.toMapView(it.span)) }
                } else {
                    looking.fog.lastSeen(onTheMap.spansOf(CharacterId(id)), day)?.let { (seen, until) ->
                        nothing.copy(character = seen.row.toMapView(seen.span).copy(seenUntil = until?.day))
                    }
                }
            }
            // In the face the house last saw, or none on ground it has not revealed: the rule a cell's snapshot keeps.
            STRUCTURE -> structures.row(StructureId(id))?.let { looking.sent(it, day) }?.let { nothing.copy(structure = it) }
            else -> null
        } ?: nothing
    }

    private companion object {
        const val HOUSE = "house"
        const val CHARACTER = "character"
        const val STRUCTURE = "structure"
    }
}
