package villages.application

import villages.domain.HandOver
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.Location
import villages.domain.ChangeLevel
import villages.domain.PlayerId
import villages.domain.Rebuild
import villages.domain.Ruin
import villages.domain.RaiseStructure
import villages.domain.StructureId
import villages.domain.StructureType

/**
 * What can be done to structures from outside the world: for now raising one and taking control of one, which only the
 * debug panel does, standing in for a house building one and for a story handing one over. See
 * docs/plans/structures.md.
 */
class StructureService(
    private val structures: StructureCommandExecutor,
    private val houses: HouseById,
    private val clock: Clock,
    private val world: WorldClock,
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
    /** Raises or lowers [structure] by [by] levels: Adam's *level up* and *level down*. Refused `invalidLevel` past either end. */
    fun changeLevel(structure: StructureId, by: Int, provenance: Provenance) {
        structures.execute(ChangeLevel(structure, by, world.today(), clock.now()), provenance)
    }

    /** Brings [structure] down to ruin: Adam's *ruin this building*. Refused `isARuin` for one that is already. */
    fun ruin(structure: StructureId, cause: String, provenance: Provenance) {
        structures.execute(Ruin(structure, cause, world.today(), clock.now()), provenance)
    }

    /** Raises the ruin [structure] again as what it was, at its first level, for nobody: Adam's *rebuild this building*. */
    fun rebuild(structure: StructureId, provenance: Provenance) {
        structures.execute(Rebuild(structure, null, 1, null, world.today(), clock.now()), provenance)
    }

    fun takeControl(player: PlayerId, structure: StructureId, provenance: Provenance) {
        val house = HouseId.of(player).also { if (houses.ofHouse(it) == null) throw HouseError.NoSuchHouse }
        structures.execute(HandOver(structure, house, world.today(), clock.now()), provenance)
    }
}
