package villages.gateway

import villages.application.VisionService
import villages.domain.Location
import villages.domain.VisionId
import villages.protocol.GiveVisionPayload
import villages.protocol.TakeVisionPayload
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
internal class SightPart(
    private val core: Core,
    private val sights: SightsByHouse,
    private val open: Boolean,
    private val visions: VisionService,
) : Part {
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

    /** Adam's levers for vision given outright and taken away, refused when the instruments are. See 0061. */
    override fun register(commands: Commands, frames: Frames) {
        // A place off the world is refused by the place itself, as `invalidLocation`.
        commands.lever<GiveVisionPayload>(open) { asking, payload ->
            visions.give(
                player = asking.who,
                place = Location(payload.place.lat, payload.place.lon),
                provenance = asking.startingAStory,
            )
        }
        commands.lever<TakeVisionPayload>(open) { asking, payload ->
            visions.take(
                player = asking.who,
                visionId = VisionId(asUuid(payload.visionId, "a vision id")),
                provenance = asking.startingAStory,
            )
        }
    }

    override fun close() {
        seen.close()
    }
}

/** Sight's place in the gateway: before anything is sent, the fog; and after the holdings, what a house sees. */
class SightMechanic(private val sights: SightsByHouse, private val visions: VisionService) : GatewayMechanic(greeting = 500) {
    override fun part(made: Made): Part = SightPart(made.core, sights, made.open, visions)
}
