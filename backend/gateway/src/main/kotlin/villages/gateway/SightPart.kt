package villages.gateway

import villages.application.Sight
import villages.application.SightsByHouse
import villages.domain.HouseId
import villages.domain.PlayerId
import villages.domain.Vision
import villages.protocol.Hello
import villages.protocol.YourSight

/**
 * What a house sees: the fog a connection looks through, from the house's vision points, and the sight itself,
 * which reaches its player wherever they are looking, like the house does - the fog of war is the player's own,
 * and needs no cell. What the fog lets through is the core's gate to keep; this part says what it is. See
 * decision records 0061 and 0075.
 */
internal class SightPart(private val core: Core, private val sights: SightsByHouse) : Part {
    /** A new sight changes what the player may be sent, so every cell they hold is answered again. */
    private val seen: AutoCloseable = sights.watch { change ->
        core.sessionOf(change.player)?.let { sightChanged(it, change.sight) }
    }

    /** Before anything is sent, so that the first cell this connection holds is already fogged. */
    override fun arrive(connection: Gateway.Connection, hello: Hello, who: PlayerId) {
        connection.look { it.copy(fog = Fog(who, sights.of(HouseId.of(who)).points)) }
    }

    override fun greet(connection: Gateway.Connection, who: PlayerId) {
        connection.out.send(YourSight(sights.of(HouseId.of(who)).toView(), Vision.SURFACE_TENSION))
    }

    /**
     * Takes the house's new sight: tells the player, and answers every held cell again, because what they
     * may be sent has changed with it - a house on ground newly revealed, somebody newly in vision or out
     * of it. The sight first, so the page is drawing the new fog when what it lets through arrives.
     */
    private fun sightChanged(connection: Gateway.Connection, sight: Sight) {
        val was = connection.look { it.copy(fog = Fog(connection.player, sight.points)) }
        connection.out.send(YourSight(sight.toView(), Vision.SURFACE_TENSION))
        if (connection.looking.fogged) {
            connection.lookedAgain(was)
        }
    }

    override fun close() {
        seen.close()
    }
}
