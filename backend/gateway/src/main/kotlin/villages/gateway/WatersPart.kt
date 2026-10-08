package villages.gateway

import villages.application.fate.WaterAt
import villages.domain.Location
import villages.domain.PlayerId
import villages.protocol.Hello
import villages.protocol.InspectAt
import villages.protocol.InspectedAt
import villages.protocol.Point
import villages.protocol.WaterView

/**
 * What water a page points at, a river, a lake or the sea. A click on the map that hit nothing else asks with the
 * place, and the answer names the water there from the master the page draws, which hello says, and only on ground the
 * house has revealed, unless Adam's switch has lifted the fog. The page's own copy of the names is never what a player
 * reads. See 0075 and 0087.
 */
internal class WatersPart(private val waters: WaterAt) : Part {
    /** The world the page draws, from hello. Null, and nothing it points at is water. */
    private class Drawn {
        @Volatile
        var master: String? = null
    }

    private fun drawnBy(connection: Gateway.Connection): Drawn = connection.keptBy(this) { Drawn() }

    override fun arrive(connection: Gateway.Connection, hello: Hello, who: PlayerId) {
        drawnBy(connection).master = hello.master
    }

    override fun register(commands: Commands, frames: Frames) {
        frames.on<InspectAt> { connection, frame -> connection.out.send(answer(connection, frame.at)) }
    }

    private fun answer(connection: Gateway.Connection, at: Point): InspectedAt {
        val place = at.takeIf { it.lat in -90.0..90.0 && it.lon in -180.0..180.0 }?.let { Location(it.lat, it.lon) }
        val looking = connection.looking
        if (place == null || (looking.fogged && !looking.fog.reveals(place))) {
            return InspectedAt(at, revealed = false, water = null)
        }
        val water = drawnBy(connection).master?.let { waters.at(it, place) }
        return InspectedAt(
            at,
            revealed = true,
            water = water?.let { WaterView(it.kind.name.lowercase(), it.id, it.name, it.also, it.of1790, it.about) },
        )
    }
}
