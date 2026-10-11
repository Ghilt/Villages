package villages.application

import villages.domain.Location
import villages.domain.RaiseStructure
import villages.domain.StructureCatalogue
import villages.domain.StructureError
import villages.domain.StructureId
import villages.domain.StructureType
import java.util.UUID

/**
 * One structure of every type in the catalogue, standing on the ice in Antarctica and held by nobody: Adam's, to fly
 * to and look at while the instruments are open. Not the world of 1790, which will raise structures in its towns; a
 * place where every type can be seen at once, far from anyone's house.
 *
 * Each is raised under an id worked out from its type, so starting again over a kept world raises none of them twice:
 * one already standing is refused, and passed over. A wipe takes them with everything else, and they stand again when
 * the server next starts. See docs/plans/structures.md.
 */
class Antarctica(
    private val structures: StructureCommandExecutor,
    private val catalogue: StructureCatalogue,
    private val clock: Clock,
    private val world: WorldClock,
) {
    /** Raises whichever of them does not stand yet, at its first level, and says how many it raised. */
    fun raise(): Int = catalogue.types.keys.withIndex().count { (at, type) -> raised(type, placeOf(at)) }

    private fun raised(type: StructureType, place: Location): Boolean = try {
        structures.execute(
            RaiseStructure(
                structureId = StructureId.inAntarctica(type),
                structureType = type,
                name = "the Antarctic ${type.inWords}",
                place = place,
                level = 1,
                holder = null,
                worldTime = world.today(),
                recordedAt = clock.now(),
            ),
            Provenance.startedBy(UUID.nameUUIDFromBytes("villages:antarctica:raise:${type.name}".toByteArray(Charsets.UTF_8))),
        )
        true
    } catch (_: StructureError.AlreadyRaised) {
        false
    }

    companion object {
        /**
         * Where the [at]th type stands: four to a row, about forty-five kilometres apart each way, on the ice of
         * Queen Maud Land, where no founding seat is offered and nothing else stands. Counted in tenths of a degree, so
         * a row's latitude is the number it is written as and not a hair off it.
         */
        fun placeOf(at: Int): Location = Location((-774 - 4 * (at / 4)) / 10.0, 10.0 + 2.0 * (at % 4))
    }
}
