package villages.gateway

import villages.application.FoundHouseService
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.protocol.FoundHousePayload
import villages.application.HouseChange
import villages.application.HousesByCell
import villages.application.HousesByPlayer
import villages.domain.PlayerId
import villages.protocol.Cell
import villages.protocol.YourHouse

/**
 * A player's own house, which reaches them wherever they are looking, on hello and whenever it changes. Nobody else's
 * house is told to anyone: a house is not drawn on the map, its structures are, its seat among them, and a window
 * on a house asks after it by itself. See decision records 0075 and 0093.
 */
internal class HousesPart(
    private val core: Core,
    houses: HousesByCell,
    private val theirHouses: HousesByPlayer,
    private val open: Boolean,
    private val foundHouse: FoundHouseService,
) : Part {
    private val changes: AutoCloseable = houses.watch { change -> told(change) }

    override fun greet(connection: Gateway.Connection, who: PlayerId) {
        connection.out.send(YourHouse(theirHouses.ofPlayer(who)?.toYours()))
    }

    private fun told(change: HouseChange) {
        val row = change.row
        // Your own house reaches you wherever you are looking.
        core.sessionOf(row.player)?.out?.send(YourHouse(row.toYours(Cell.of(row.seat.lat, row.seat.lon))))
    }

    /** Adam's lever: founding the sender's house, standing in for the founding choice. Refused when the instruments are. */
    override fun register(commands: Commands, frames: Frames) {
        commands.lever<FoundHousePayload>(open) { asking, payload ->
            foundHouse.found(
                houseId = HouseId.of(asking.who),
                player = asking.who,
                name = HouseName.of(payload.name),
                seat = Location(payload.seat.lat, payload.seat.lon),
                banner = payload.banner.toDomain(),
                provenance = asking.startingAStory,
            )
        }
    }

    override fun close() {
        changes.close()
    }
}

/** The houses' place in the gateway: the first thing a player arriving is told is their house. */
class HousesMechanic(
    private val houses: HousesByCell,
    private val theirHouses: HousesByPlayer,
    private val foundHouse: FoundHouseService,
) : GatewayMechanic(greeting = 100) {
    override fun part(made: Made): Part = HousesPart(made.core, houses, theirHouses, made.open, foundHouse)
}
