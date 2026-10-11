package villages.application

import villages.domain.ChangeLevel
import villages.domain.CharacterId
import villages.domain.Content
import villages.domain.ContentId
import villages.domain.EmptySlot
import villages.domain.FillSlot
import villages.domain.HandOver
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.RaiseStructure
import villages.domain.Resource
import villages.domain.Rebuild
import villages.domain.Ruin
import villages.domain.StructureError
import villages.domain.StructureId
import villages.domain.StructureType
import villages.domain.id

/**
 * What can be done to structures from outside the world: raising one, taking control of one, its level, its slots,
 * its ruin, which only the debug panel does for now, standing in for a house building one and for a story handing
 * one over or filling it. See docs/plans/structures.md.
 */
class StructureService(
    private val structures: StructureCommandExecutor,
    private val houses: HouseById,
    private val clock: Clock,
    private val world: WorldClock,
    private val slots: StructureSlots,
    private val ids: FreshIds,
) {
    /**
     * Raises a structure of [type] at [level] at [place], held by the player's own house when [yours] and by nobody
     * otherwise, and says which it is. Its id is worked out from the player and the command, so a command sent twice
     * is refused the second time rather than raising a twin. A house that does not exist holds nothing: raising one
     * for a player who has founded none is refused `noSuchHouse`.
     */
    fun raise(
        player: PlayerId,
        type: StructureType,
        level: Int,
        place: Location,
        yours: Boolean,
        provenance: Provenance,
    ): StructureId {
        val holder = if (yours) HouseId.of(player).also { if (houses.ofHouse(it) == null) throw HouseError.NoSuchHouse } else null
        val id = StructureId.raisedBy(player, provenance.commandId)
        structures.execute(
            RaiseStructure(id, type, "a new ${type.inWords}", place, level, holder, world.today(), clock.now()),
            provenance,
        )
        return id
    }

    /**
     * Hands [structure] to the player's own house: Adam's *take control of this building*, standing in for a story
     * handing one over or a house taking it. Refused `noSuchHouse` for a player who has founded none,
     * `noSuchStructure` for one never raised, and `sameHolder` for one the house holds already.
     */
    fun takeControl(player: PlayerId, structure: StructureId, provenance: Provenance) {
        val house = HouseId.of(player).also { if (houses.ofHouse(it) == null) throw HouseError.NoSuchHouse }
        structures.execute(HandOver(structure, house, world.today(), clock.now()), provenance)
    }

    /** Raises or lowers [structure] by [by] levels: Adam's *level up* and *level down*. Refused `invalidLevel` past either end. */
    fun changeLevel(structure: StructureId, by: Int, provenance: Provenance) {
        structures.execute(ChangeLevel(structure, by, world.today(), clock.now()), provenance)
    }

    /**
     * Puts a person in a place of [slot] of [structure], out of whichever slot they were in first, in the same story:
     * a person is in one slot at a time, across every structure, and this is what holds it, a moment after rather than
     * at once, because the two slots are two histories. Refused as the structure refuses: `slotFull`, `noSuchSlot`,
     * `alreadyInSlot` for one already there.
     */
    fun fillWithPerson(structure: StructureId, slot: String, character: CharacterId, provenance: Provenance) {
        slots.slotOf(character)?.takeIf { it.structure != structure || it.slot != slot }?.let { was ->
            try {
                structures.execute(EmptySlot(was.structure, was.slot, ContentId(character.value), world.today(), clock.now()), provenance)
            } catch (_: StructureError.NotInSlot) {
                // Taken out already, by something the read model had not yet heard of: nothing to take them out of.
            }
        }
        structures.execute(FillSlot(structure, slot, Content.Person(character), world.today(), clock.now()), provenance)
    }

    /**
     * Puts an item in a place of [slot] of [structure], under an id minted here, the first time it is put anywhere, with
     * what it [yields] of its own a month.
     */
    fun fillWithItem(
        structure: StructureId,
        slot: String,
        name: String,
        about: String,
        amount: Long?,
        yields: Map<Resource, Double>,
        provenance: Provenance,
    ) {
        val item = Content.Item(ContentId(ids.fresh()), name.trim(), about.trim(), amount, yields)
        structures.execute(FillSlot(structure, slot, item, world.today(), clock.now()), provenance)
    }

    /**
     * Takes out of [slot] of [structure] what was put in it last: Adam's *empty a place*, standing in for a prisoner
     * let go or a relic carried off. Refused `notInSlot` when there is nothing in it.
     */
    fun emptyLast(structure: StructureId, slot: String, provenance: Provenance) {
        val last = slots.of(structure)[slot]?.lastOrNull() ?: throw StructureError.NotInSlot
        structures.execute(EmptySlot(structure, slot, last.id, world.today(), clock.now()), provenance)
    }

    /** Brings [structure] down to ruin: Adam's *ruin this building*. Refused `isARuin` for one that is already. */
    fun ruin(structure: StructureId, cause: String, provenance: Provenance) {
        structures.execute(Ruin(structure, cause, world.today(), clock.now()), provenance)
    }

    /** Raises the ruin [structure] again as what it was, at its first level, for nobody: Adam's *rebuild this building*. */
    fun rebuild(structure: StructureId, provenance: Provenance) {
        structures.execute(Rebuild(structure, null, 1, null, world.today(), clock.now()), provenance)
    }
}
