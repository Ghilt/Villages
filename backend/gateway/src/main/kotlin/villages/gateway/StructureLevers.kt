package villages.gateway

import villages.application.Antarctica
import villages.application.StructureService
import villages.domain.Location
import villages.domain.StructureType
import villages.protocol.CommandPayload
import villages.protocol.RaiseAntarcticaPayload
import villages.protocol.RaiseStructurePayload

/**
 * One of Adam's levers: a command like any other, refused `instrumentsClosed` while the instruments are closed. Shared
 * by the instruments and each mechanic's own file of levers, so that a mechanic's levers do not grow the instruments
 * with them. See decision record 0076.
 */
internal inline fun <reified P : CommandPayload> Commands.lever(open: Boolean, noinline pull: (Asking, P) -> Unit) {
    on<P> { asking, payload ->
        if (!open) {
            throw InstrumentsClosed()
        }
        pull(asking, payload)
    }
}

/**
 * Adam's levers for structures, standing in for the world: one raised where the panel looks, and Antarctica's sixteen
 * raised again after a wipe has taken them. Registered by the instruments and closed with them. A type the catalogue
 * lacks is refused `noSuchType`, a level the type lacks `invalidLevel`, a place off the world `invalidLocation`, and a
 * type that is not even a name is malformed. See docs/plans/structures.md.
 */
internal fun structureLevers(commands: Commands, open: Boolean, structures: StructureService, antarctica: Antarctica) {
    commands.lever<RaiseStructurePayload>(open) { asking, payload ->
        structures.raise(
            player = asking.who,
            type = StructureType(payload.structureType),
            level = payload.level,
            place = Location(payload.place.lat, payload.place.lon),
            yours = payload.yours,
            provenance = asking.startingAStory,
        )
    }
    commands.lever<RaiseAntarcticaPayload>(open) { _, _ -> antarctica.raise() }
}
