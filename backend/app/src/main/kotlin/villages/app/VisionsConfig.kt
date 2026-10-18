package villages.app

import villages.gateway.GatewayMechanic
import villages.gateway.SightMechanic
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.FreshIds
import villages.application.VisionService
import villages.application.WorldClock
import villages.occurrent.EventWorld
import villages.projections.SightProjection
import java.time.Clock

/**
 * Vision: given outright and taken away, and what every house sees. See decision record 0061.
 * One mechanic's beans in a configuration of its own, so a mechanic is wired where it is: see
 * `docs/plans/mechanic-modules.md`, step 4.
 */
@Configuration
class VisionsConfig {
    /** Giving a house vision of a place outright, and taking it away. See decision record 0061. */
    @Bean
    fun visions(world: EventWorld, clock: Clock, worldClock: WorldClock, ids: FreshIds): VisionService =
        VisionService(world.executor, clock = { clock.instant() }, world = worldClock, ids = ids)

    /** What every house sees, worked out from where its seat and its people stand. See decision 0061. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun sights(world: EventWorld): SightProjection = SightProjection(world.feed)

    /** Sight's place in the gateway: the fog, what a house sees, and the levers giving vision. See 0061. */
    @Bean
    fun sightInTheGateway(sights: SightProjection, visions: VisionService): GatewayMechanic = SightMechanic(sights, visions)
}
