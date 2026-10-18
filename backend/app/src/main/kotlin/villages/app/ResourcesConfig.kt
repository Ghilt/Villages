package villages.app

import villages.gateway.GatewayMechanic
import villages.gateway.ResourcesMechanic
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.FreshIds
import villages.application.Faults
import villages.application.MonthlyWorldClock
import villages.application.Pledges
import villages.application.ResourceService
import villages.application.ScheduledLater
import villages.application.WorldCalendar
import villages.application.WorldClock
import villages.occurrent.EventWorld
import java.time.Clock

/**
 * Resources: what a house has, granted, spent and pledged, and the pledges given back. See decision record 0006.
 * One mechanic's beans in a configuration of its own, so a mechanic is wired where it is: see
 * `docs/plans/mechanic-modules.md`, step 4.
 */
@Configuration
class ResourcesConfig {
    @Bean
    fun resources(
        world: EventWorld,
        clock: Clock,
        worldClock: WorldClock,
        calendar: WorldCalendar,
        ids: FreshIds,
    ): ResourceService =
        ResourceService(world.executor, clock = { clock.instant() }, world = worldClock, calendar = calendar, ids = ids)

    /** Gives a pledge back when its span is up. One wake-up a pledge, and none at all without one. */
    @Bean(initMethod = "start", destroyMethod = "close")
    @Suppress("LongParameterList")
    fun pledges(
        world: EventWorld,
        later: ScheduledLater,
        faults: Faults,
        resources: ResourceService,
        worldClock: MonthlyWorldClock,
        clock: Clock,
        ids: FreshIds,
    ): Pledges = Pledges(world.storeFeed, later, faults, world.gate, resources, worldClock, clock = { clock.instant() }, ids = ids)

    /** The resources' place in the gateway: Adam's levers granting, spending, pledging and releasing. See 0006. */
    @Bean
    fun resourcesInTheGateway(resources: ResourceService): GatewayMechanic = ResourcesMechanic(resources)
}
