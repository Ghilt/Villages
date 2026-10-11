package villages.application

import villages.domain.Location
import villages.domain.RaiseStructure
import villages.domain.StructureCatalogue
import villages.domain.StructureError
import villages.domain.StructureId
import villages.domain.StructureType
import java.util.UUID

/**
 * One structure of every type in the catalogue, standing on an Antarctic island and held by nobody: Adam's, to fly
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
         * Where the [at]th type stands: four to a row, the castle at the north-west corner, on the island off the
         * tip of the Antarctic Peninsula that Adam chose on 2026-10-11, about its middle at 63.247 south, 56.030 west.
         * Four kilometres apart each way, so all sixteen are on the screen at once from zoom 9: eight hundredths of a
         * degree east, and on a map that stretches latitude as Mercator does, 0.036 degrees south looks as far.
         * Counted in thousandths of a degree, so a place is the number it is written as and not a hair off it.
         */
        fun placeOf(at: Int): Location = Location((-63_193 - 36 * (at / 4)) / 1000.0, (-56_150 + 80 * (at % 4)) / 1000.0)
    }
}
