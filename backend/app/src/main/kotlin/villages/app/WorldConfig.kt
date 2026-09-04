package villages.app

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.AnonymousTokens
import villages.application.FoundHouseService
import villages.gateway.Gateway
import villages.occurrent.InMemoryWorld
import java.time.Clock

/**
 * The wiring. Everything the world is made of, chosen here and nowhere else: today the in-memory world,
 * because there is no MongoDB on this machine yet; from increment 0.8 a profile chooses between this and
 * the real store, and nothing that depends on the ports changes.
 */
@Configuration
class WorldConfig {
    @Bean(destroyMethod = "close")
    fun world(): InMemoryWorld = InMemoryWorld()

    @Bean
    fun clock(): Clock = Clock.systemUTC()

    @Bean
    fun foundHouse(world: InMemoryWorld, clock: Clock): FoundHouseService =
        FoundHouseService(world.executor, clock = { clock.instant() })

    @Bean(destroyMethod = "close")
    fun gateway(world: InMemoryWorld, foundHouse: FoundHouseService, clock: Clock): Gateway =
        Gateway(tokens = AnonymousTokens, foundHouse = foundHouse, events = world.feed, clock = clock)
}
