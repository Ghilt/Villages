package villages.app

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.AnonymousTokens
import villages.application.DailyWorldClock
import villages.application.FoundHouseService
import villages.application.WorldClock
import villages.domain.WorldTime
import villages.gateway.Gateway
import villages.occurrent.InMemoryWorld
import villages.projections.HousesProjection
import villages.protocol.Calendar
import java.time.Clock
import java.time.Instant

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

    /**
     * The world's day: one a real day since the world opened on the first of September 2026, in year 1200.
     * The chrono-engine's placeholder; see SETTING.md on the shared world-day, and decision record 0027.
     */
    @Bean
    fun worldClock(clock: Clock): WorldClock = DailyWorldClock(
        clock = { clock.instant() },
        opened = Instant.parse("2026-09-01T00:00:00Z"),
        openingDay = WorldTime(Calendar.dayOf(1200, 1)),
    )

    @Bean
    fun foundHouse(world: InMemoryWorld, clock: Clock, worldClock: WorldClock): FoundHouseService =
        FoundHouseService(world.executor, clock = { clock.instant() }, world = worldClock)

    /** The map's read model, folded from the feed. In memory, so it starts empty with the store. */
    @Bean(destroyMethod = "close")
    fun houses(world: InMemoryWorld): HousesProjection = HousesProjection(world.feed)

    @Bean(destroyMethod = "close")
    fun gateway(
        world: InMemoryWorld,
        foundHouse: FoundHouseService,
        houses: HousesProjection,
        clock: Clock,
        worldClock: WorldClock,
    ): Gateway = Gateway(
        tokens = AnonymousTokens,
        foundHouse = foundHouse,
        events = world.feed,
        houses = houses,
        theirHouses = houses,
        clock = clock,
        world = worldClock,
    )
}
