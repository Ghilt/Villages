package villages.gateway

import villages.application.Antarctica
import villages.application.StructureService
import villages.domain.CharacterId
import villages.domain.Location
import villages.domain.StructureId
import villages.domain.StructureType
import villages.protocol.CommandPayload
import villages.protocol.RaiseAntarcticaPayload
import villages.protocol.RaiseStructurePayload
import villages.protocol.ChangeLevelPayload
import villages.protocol.EmptySlotPayload
import villages.protocol.FillSlotPayload
import villages.protocol.RebuildPayload
import villages.protocol.RuinPayload
import villages.protocol.TakeControlPayload
import java.util.UUID

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
 * Adam's levers for structures, standing in for the world: one raised where the panel looks, Antarctica's sixteen
 * raised again after a wipe has taken them, one handed to the sender's house, one raised or lowered a level, a
 * place of a slot filled or emptied, and one ruined or rebuilt. Registered by the instruments and closed with them. A type the catalogue
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
    // An id that is not one is malformed, as a type that is not a name is.
    commands.lever<ChangeLevelPayload>(open) { asking, payload ->
        structures.changeLevel(StructureId(UUID.fromString(payload.structureId)), payload.by, asking.startingAStory)
    }
    commands.lever<FillSlotPayload>(open) { asking, payload ->
        val structure = StructureId(UUID.fromString(payload.structureId))
        if (payload.characterId != null) {
            structures.fillWithPerson(structure, payload.slot, CharacterId(UUID.fromString(payload.characterId)), asking.startingAStory)
        } else {
            val item = requireNotNull(payload.item) { "a slot is filled with someone or with something" }
            val yields = item.yields.orEmpty().mapKeys { (name, _) -> asResource(name) }
            structures.fillWithItem(structure, payload.slot, item.name, item.about, item.amount, yields, asking.startingAStory)
        }
    }
    commands.lever<EmptySlotPayload>(open) { asking, payload ->
        structures.emptyLast(StructureId(UUID.fromString(payload.structureId)), payload.slot, asking.startingAStory)
    }
    commands.lever<RuinPayload>(open) { asking, payload ->
        structures.ruin(StructureId(UUID.fromString(payload.structureId)), payload.cause, asking.startingAStory)
    }
    commands.lever<RebuildPayload>(open) { asking, payload ->
        structures.rebuild(StructureId(UUID.fromString(payload.structureId)), asking.startingAStory)
    }
    commands.lever<TakeControlPayload>(open) { asking, payload ->
        structures.takeControl(asking.who, StructureId(UUID.fromString(payload.structureId)), asking.startingAStory)
    }
}
