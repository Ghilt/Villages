package villages.gateway

import villages.application.KeyFigureService
import villages.domain.CharacterId
import villages.domain.Location
import villages.protocol.AddKeyFigurePayload
import villages.protocol.AgeCharacterPayload
import villages.protocol.ChangePortraitPayload
import villages.protocol.ChangeStatPayload
import villages.protocol.KillCharacterPayload
import villages.protocol.MoveCharacterPayload
import villages.protocol.TakeOffTheMapPayload
import villages.application.CharacterMapChange
import villages.application.CharacterRow
import villages.application.CharacterSpan
import villages.application.CharactersByCell
import villages.application.KeyFiguresByHouse
import villages.application.WorldClock
import villages.domain.HouseId
import villages.domain.PlayerId
import villages.protocol.Cell
import villages.protocol.CharacterArrived
import villages.protocol.CharacterChanged
import villages.protocol.CharacterGone
import villages.protocol.YourKeyFigures
import villages.protocol.ON_THE_MAP_FROM

/**
 * The key figures and the people on the map: a house's own figures, which reach its player wherever they are
 * looking, and every character's moves, fanned out to whoever holds a cell either side of one. See decision
 * records 0055 and 0075.
 */
internal class KeyFiguresPart(
    private val core: Core,
    private val figures: KeyFiguresByHouse,
    onTheMap: CharactersByCell,
    private val world: WorldClock,
    private val open: Boolean,
    private val keyFigures: KeyFigureService,
) : Part {
    /** Whom a house holds is its own, and needs no cell. See decision record 0055. */
    private val changed: AutoCloseable = figures.watch { change ->
        core.sessionOf(change.player)?.out?.send(YourKeyFigures(change.keyFigures.map { it.toView() }))
    }

    /** A character who moves, leaves the map or dies on it reaches whoever holds the cells either side. */
    private val moves: AutoCloseable = onTheMap.watchTheMap { change -> fanOutMove(change) }

    override fun greet(connection: Gateway.Connection, who: PlayerId) {
        connection.out.send(YourKeyFigures(figures.of(HouseId.of(who)).map { it.toView() }))
    }

    /**
     * A character's move, told to each connection as the one delta that fits it.
     *
     * A house never moves, so its fan-out only ever adds; a character leaves cells as well as entering
     * them, and a connection that is not told so goes on drawing them where they were. So who was shown
     * them before is worked out as well as who is shown them now: a connection in both is told they
     * changed, one only in the second that they arrived, one only in the first that they are gone. Only
     * connections looking at the live world: a move today changes no earlier day's map. Walking into a
     * house's vision is arriving and walking out of it is going, by the same arithmetic.
     */
    private fun fanOutMove(change: CharacterMapChange) {
        val before = heldAt(change.row, change.was)
        val after = heldAt(change.row, change.now)
        val view = change.now?.let { change.row.toMapView(it) }
        if (view != null) {
            for (connection in after) {
                if (connection.looking.isLive) {
                    connection.enqueue(if (connection in before) CharacterChanged(view) else CharacterArrived(view))
                }
            }
        }
        for (connection in before - after) {
            if (connection.looking.isLive) {
                connection.enqueue(CharacterGone(change.row.id.value.toString(), change.row.revision))
            }
        }
    }

    /**
     * The connections a character standing in this span is drawn for: every one holding a cell their place
     * falls in, from the zoom everything on the map is sent at, or at any zoom with the eye open, and
     * whose fog lets them through there.
     */
    private fun heldAt(row: CharacterRow, span: CharacterSpan?): Set<Gateway.Connection> {
        if (span == null) {
            return emptySet()
        }
        val deepest = Cell.of(span.place.lat, span.place.lon)
        val found = mutableSetOf<Gateway.Connection>()
        for (zoom in 0..Cell.MAX_ZOOM) {
            val holders = core.holders(deepest.at(zoom).quadkey) ?: continue
            for (connection in holders) {
                val looking = connection.looking
                if ((zoom >= ON_THE_MAP_FROM || looking.everything) && looking.letsSee(row, span, looking.day(world::today))) {
                    found += connection
                }
            }
        }
        return found
    }

    /** Adam's levers for a house's people, standing in for the world: refused when the instruments are. See 0055. */
    override fun register(commands: Commands, frames: Frames) {
        commands.lever<AddKeyFigurePayload>(open) { asking, _ -> keyFigures.add(asking.who, asking.startingAStory) }
        commands.lever<ChangeStatPayload>(open) { asking, payload ->
            keyFigures.changeStat(
                player = asking.who,
                characterId = figure(payload.characterId),
                stat = asStat(payload.stat),
                by = payload.by,
                provenance = asking.startingAStory,
            )
        }
        commands.lever<AgeCharacterPayload>(open) { asking, payload ->
            keyFigures.age(
                player = asking.who,
                characterId = figure(payload.characterId),
                years = payload.years,
                provenance = asking.startingAStory,
            )
        }
        commands.lever<ChangePortraitPayload>(open) { asking, payload ->
            keyFigures.changePortrait(
                player = asking.who,
                characterId = figure(payload.characterId),
                portrait = payload.portrait,
                provenance = asking.startingAStory,
            )
        }
        commands.lever<KillCharacterPayload>(open) { asking, payload ->
            keyFigures.kill(
                player = asking.who,
                characterId = figure(payload.characterId),
                cause = payload.cause,
                provenance = asking.startingAStory,
            )
        }
        // A place off the world is refused by the place itself, as `invalidLocation`.
        commands.lever<MoveCharacterPayload>(open) { asking, payload ->
            keyFigures.move(
                player = asking.who,
                characterId = figure(payload.characterId),
                place = Location(payload.place.lat, payload.place.lon),
                provenance = asking.startingAStory,
            )
        }
        commands.lever<TakeOffTheMapPayload>(open) { asking, payload ->
            keyFigures.takeOffTheMap(
                player = asking.who,
                characterId = figure(payload.characterId),
                provenance = asking.startingAStory,
            )
        }
    }

    private fun figure(id: String) = CharacterId(asUuid(id, "a character id"))

    override fun close() {
        changed.close()
        moves.close()
    }
}

/** The key figures' place in the gateway: told after the house, whom it holds. */
class KeyFiguresMechanic(
    private val figures: KeyFiguresByHouse,
    private val onTheMap: CharactersByCell,
    private val keyFigures: KeyFigureService,
) : GatewayMechanic(greeting = 200) {
    override fun part(made: Made): Part = KeyFiguresPart(made.core, figures, onTheMap, made.world, made.open, keyFigures)
}
