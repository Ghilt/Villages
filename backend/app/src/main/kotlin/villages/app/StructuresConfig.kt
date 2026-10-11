package villages.app

import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.Antarctica
import villages.application.Faults
import villages.application.ScheduledLater
import villages.application.StandingEffects
import villages.application.StructureCommandExecutor
import villages.application.StructureService
import villages.application.VisionService
import villages.application.WorldClock
import villages.domain.StructureCatalogue
import villages.occurrent.EventWorld
import villages.projections.HousesProjection
import villages.projections.StructuresProjection
import java.nio.file.Files
import java.nio.file.Path
import java.time.Clock

/**
 * Structures, wired: the catalogue of their types, read once when the server starts from `world/structures.json`, or
 * from `villages.structures`; their streams, in the one store with everything else; and the sixteen standing in
 * Antarctica. A configuration of its own rather than more of `WorldConfig`, so that structures grow here. See
 * docs/plans/structures.md and decision record 0092.
 */
@Configuration
class StructuresConfig {
    @Bean
    fun structureCatalogue(@Value("\${villages.structures:../../world/structures.json}") file: String): StructureCatalogue =
        StructureCatalogueFile.parse(Files.readString(Path.of(file)))

    @Bean
    fun structureExecutor(world: EventWorld, catalogue: StructureCatalogue): StructureCommandExecutor =
        world.structureExecutor(catalogue)

    /** The structures on the map, by cell, with every face each has had: what a snapshot and the fog read. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun structuresOnTheMap(world: EventWorld): StructuresProjection = StructuresProjection(world.feed)

    /** Raising one where Adam's debug panel looks, for his own house or for nobody. */
    @Bean
    fun structures(structures: StructureCommandExecutor, houses: HousesProjection, clock: Clock, worldClock: WorldClock): StructureService =
        StructureService(structures, houses, { clock.instant() }, worldClock)

    /** What each structure gives its holder, written into the holder's history: for now what it lets them see. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun standingEffects(
        world: EventWorld,
        later: ScheduledLater,
        faults: Faults,
        catalogue: StructureCatalogue,
        visions: VisionService,
    ): StandingEffects = StandingEffects(world.feed, later, faults, catalogue, visions)

    @Bean
    fun antarctica(structures: StructureCommandExecutor, catalogue: StructureCatalogue, clock: Clock, worldClock: WorldClock): Antarctica =
        Antarctica(structures, catalogue, { clock.instant() }, worldClock)

    /**
     * The sixteen raised once everything is wired and following the feed, and only while the instruments are open:
     * Adam's furniture, which a server with its instruments closed has none of (0076).
     */
    @Bean
    fun raiseAntarctica(antarctica: Antarctica, @Value("\${villages.instruments:true}") instruments: Boolean): ApplicationRunner =
        ApplicationRunner { if (instruments) antarctica.raise() }
}
