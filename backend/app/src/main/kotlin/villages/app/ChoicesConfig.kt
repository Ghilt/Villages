package villages.app

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.Arrival
import villages.application.FreshIds
import villages.application.TakeActionService
import villages.application.WorldClock
import villages.occurrent.EventWorld
import villages.projections.ChoicesProjection
import java.time.Clock

/**
 * Choices: a player arriving and asked where, and the option taken. See decision record 0034.
 * One mechanic's beans in a configuration of its own, so a mechanic is wired where it is: see
 * `docs/plans/mechanic-modules.md`, step 4.
 */
@Configuration
class ChoicesConfig {
    /** What happens when a player arrives: with no house and nothing pending, they are asked where. */
    @Bean
    fun arrival(world: EventWorld, clock: Clock, worldClock: WorldClock, ids: FreshIds): Arrival =
        Arrival(world.executor, clock = { clock.instant() }, world = worldClock, ids = ids)

    @Bean
    fun takeAction(world: EventWorld, clock: Clock, worldClock: WorldClock): TakeActionService =
        TakeActionService(world.executor, clock = { clock.instant() }, world = worldClock)

    /** What each player has been asked and has not answered, folded from the same feed. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun choices(world: EventWorld): ChoicesProjection = ChoicesProjection(world.feed)
}
