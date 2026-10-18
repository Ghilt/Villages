package villages.app

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.FoundHouseService
import villages.application.WorldClock
import villages.occurrent.EventWorld
import villages.projections.HousesProjection
import java.time.Clock

/**
 * Houses: founding one, and the map's read model of every house. See decision record 0028.
 * One mechanic's beans in a configuration of its own, so a mechanic is wired where it is: see
 * `docs/plans/mechanic-modules.md`, step 4.
 */
@Configuration
class HousesConfig {
    @Bean
    fun foundHouse(world: EventWorld, clock: Clock, worldClock: WorldClock): FoundHouseService =
        FoundHouseService(world.executor, clock = { clock.instant() }, world = worldClock)

    /** The map's read model, folded from the feed. In memory, so it starts empty with the store. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun houses(world: EventWorld): HousesProjection = HousesProjection(world.feed)
}
