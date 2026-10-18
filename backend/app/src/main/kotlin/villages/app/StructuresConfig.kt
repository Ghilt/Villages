package villages.app

import villages.gateway.GatewayMechanic
import villages.gateway.HoldingsMechanic
import villages.gateway.StructuresMechanic
import villages.projections.CharactersProjection
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.Antarctica
import villages.application.Faults
import villages.application.IncomeService
import villages.application.ScheduledLater
import villages.application.Seats
import villages.application.StandingEffects
import villages.application.StructureCommandExecutor
import villages.application.StructureService
import villages.application.VisionService
import villages.application.WorldClock
import villages.application.Shelf
import villages.occurrent.EventWorld
import villages.projections.HousesProjection
import villages.projections.StructuresProjection
import java.time.Clock
import java.util.UUID

/**
 * Structures, wired: the catalogue of their types, the one the shelf holds in force, `world/catalogues/structures.json`;
 * their streams, in the one store with everything else; and the sixteen standing in
 * Antarctica. A configuration of its own rather than more of `WorldConfig`, so that structures grow here. See
 * docs/plans/structures.md and decision record 0093.
 */
@Configuration
class StructuresConfig {
    @Bean
    fun structureExecutor(world: EventWorld, shelf: Shelf): StructureCommandExecutor =
        world.structureExecutor { shelf.structures }

    /** The structures on the map, by cell, with every face each has had: what a snapshot and the fog read. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun structuresOnTheMap(world: EventWorld): StructuresProjection = StructuresProjection(world.feed)

    /** Raising one where Adam's debug panel looks, for his own house or for nobody. */
    @Bean
    fun structures(
        structures: StructureCommandExecutor,
        houses: HousesProjection,
        onTheMap: StructuresProjection,
        clock: Clock,
        worldClock: WorldClock,
    ): StructureService = StructureService(structures, houses, { clock.instant() }, worldClock, onTheMap, { UUID.randomUUID() })

    /** Founding raises the house's castle and names it the seat. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun seats(world: EventWorld, later: ScheduledLater, faults: Faults, structures: StructureCommandExecutor, clock: Clock): Seats =
        Seats(world.storeFeed, later, faults, world.gate, structures, world.executor, { clock.instant() })

    /** What each structure gives its holder, written into the holder's history: what it lets them see, and what it pays. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun standingEffects(
        world: EventWorld,
        later: ScheduledLater,
        faults: Faults,
        shelf: Shelf,
        visions: VisionService,
        clock: Clock,
        worldClock: WorldClock,
    ): StandingEffects =
        StandingEffects(world.storeFeed, later, faults, world.gate, { shelf.structures }, visions, IncomeService(world.executor, { clock.instant() }, worldClock))

    @Bean
    fun antarctica(structures: StructureCommandExecutor, shelf: Shelf, clock: Clock, worldClock: WorldClock): Antarctica =
        Antarctica(structures, { shelf.structures }, { clock.instant() }, worldClock)

    /**
     * The sixteen raised once everything is wired and following the feed, and only while the instruments are open:
     * Adam's furniture, which a server with its instruments closed has none of (0076).
     */
    @Bean
    fun raiseAntarctica(antarctica: Antarctica, @Value("\${villages.instruments:true}") instruments: Boolean): ApplicationRunner =
        ApplicationRunner { if (instruments) antarctica.raise() }

    /** The holdings' place in the gateway: what a house holds, every slot of it shown. See docs/plans/structures.md. */
    @Bean
    fun holdingsInTheGateway(
        structuresOnTheMap: StructuresProjection,
        houses: HousesProjection,
        shelf: Shelf,
        characters: CharactersProjection,
    ): GatewayMechanic = HoldingsMechanic(structuresOnTheMap, houses, { shelf.structures }, characters)

    /** The structures' place in the gateway: on the map, and Adam's levers for them. See docs/plans/structures.md. */
    @Bean
    fun structuresInTheGateway(
        structuresOnTheMap: StructuresProjection,
        structures: StructureService,
        antarctica: Antarctica,
    ): GatewayMechanic = StructuresMechanic(structuresOnTheMap, structures, antarctica)
}
