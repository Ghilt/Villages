package villages.app

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.AnonymousTokens
import villages.application.Arrival
import villages.application.FoundHouseService
import villages.application.FreshIds
import villages.application.MonthlyWorldClock
import villages.application.TakeActionService
import villages.application.WorldCalendar
import villages.application.WorldClock
import villages.application.WorldWipe
import villages.domain.WorldTime
import villages.gateway.Gateway
import villages.occurrent.InMemoryWorld
import villages.projections.ChoicesProjection
import villages.projections.HousesProjection
import villages.projections.RecentEventsProjection
import villages.protocol.Calendar
import java.time.Clock
import java.time.Instant
import java.util.UUID

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
     * The world's calendar, handed to the application layer, which may not see the protocol module itself.
     */
    @Bean
    fun worldCalendar(): WorldCalendar = WorldCalendar { day, months ->
        WorldTime(Calendar.plusMonths(day.day, months))
    }

    /**
     * The world's day: one world-month for every real day since the world opened on the first of September
     * 2026, in year 1200 of the world's own reckoning. The chrono-engine's placeholder; see SETTING.md on
     * the shared world-day, and decision records 0027 and 0051.
     */
    @Bean
    fun worldClock(clock: Clock, calendar: WorldCalendar): WorldClock = MonthlyWorldClock(
        clock = { clock.instant() },
        calendar = calendar,
        opened = Instant.parse("2026-09-01T00:00:00Z"),
        openingDay = WorldTime(Calendar.dayOf(1200, 1, 1)),
    )

    @Bean
    fun foundHouse(world: InMemoryWorld, clock: Clock, worldClock: WorldClock): FoundHouseService =
        FoundHouseService(world.executor, clock = { clock.instant() }, world = worldClock)

    /** Message ids. Aggregate identities are derived and never come from here; see decision 0035. */
    @Bean
    fun freshIds(): FreshIds = FreshIds { UUID.randomUUID() }

    /** What happens when a player arrives: with no house and nothing pending, they are asked where. */
    @Bean
    fun arrival(world: InMemoryWorld, clock: Clock, worldClock: WorldClock, ids: FreshIds): Arrival =
        Arrival(world.executor, clock = { clock.instant() }, world = worldClock, ids = ids)

    @Bean
    fun takeAction(world: InMemoryWorld, clock: Clock, worldClock: WorldClock): TakeActionService =
        TakeActionService(world.executor, clock = { clock.instant() }, world = worldClock)

    /** The map's read model, folded from the feed. In memory, so it starts empty with the store. */
    @Bean(destroyMethod = "close")
    fun houses(world: InMemoryWorld): HousesProjection = HousesProjection(world.feed)

    /** What each player has been asked and has not answered, folded from the same feed. */
    @Bean(destroyMethod = "close")
    fun choices(world: InMemoryWorld): ChoicesProjection = ChoicesProjection(world.feed)

    /** The end of the chronicle, kept so the event viewer can show what happened before it opened. */
    @Bean(destroyMethod = "close")
    fun recentEvents(world: InMemoryWorld): RecentEventsProjection = RecentEventsProjection(world.feed)

    /**
     * Emptying the development world: the store and every read model folded from it, in one act, so that
     * no projection is left holding a house whose events are gone. See decision record 0036.
     */
    @Bean
    fun worldWipe(
        world: InMemoryWorld,
        houses: HousesProjection,
        choices: ChoicesProjection,
        recentEvents: RecentEventsProjection,
    ): WorldWipe = WorldWipe {
        world.wipe().also {
            houses.reset()
            choices.reset()
            recentEvents.reset()
        }
    }

    @Bean(destroyMethod = "close")
    @Suppress("LongParameterList")
    fun gateway(
        world: InMemoryWorld,
        foundHouse: FoundHouseService,
        houses: HousesProjection,
        choices: ChoicesProjection,
        recentEvents: RecentEventsProjection,
        arrival: Arrival,
        takeAction: TakeActionService,
        worldWipe: WorldWipe,
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
        arrival = arrival,
        takeAction = takeAction,
        choices = choices,
        recent = recentEvents,
        emptyTheWorld = worldWipe,
    )
}
