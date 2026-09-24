package villages.app

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.AnonymousTokens
import villages.application.Arrival
import villages.application.Dice
import villages.application.FoundHouseService
import villages.application.FreshIds
import villages.application.KeyFigureService
import villages.application.Later
import villages.application.MonthlyWorldClock
import villages.application.Mourning
import villages.application.Pledges
import villages.application.Portraits
import villages.application.ResourceService
import villages.application.ScheduledLater
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
import java.nio.file.Path
import java.time.Clock
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ThreadLocalRandom

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
    fun worldCalendar(): WorldCalendar = object : WorldCalendar {
        override fun plusMonths(day: WorldTime, months: Long) = WorldTime(Calendar.plusMonths(day.day, months))

        override fun monthsBetween(from: WorldTime, to: WorldTime) = Calendar.monthsBetween(from.day, to.day)
    }

    /**
     * The world's day: one world-month for every real day since the world opened on the first of September
     * 2026, on the first of January 1790. The chrono-engine's placeholder; see SETTING.md on the age and
     * the shared world-day, and decision records 0027 and 0053.
     */
    @Bean
    fun worldClock(clock: Clock, calendar: WorldCalendar): MonthlyWorldClock = MonthlyWorldClock(
        clock = { clock.instant() },
        calendar = calendar,
        opened = Instant.parse("2026-09-01T00:00:00Z"),
        openingDay = WorldTime(Calendar.dayOf(1790, 1, 1)),
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
    fun resources(
        world: InMemoryWorld,
        clock: Clock,
        worldClock: WorldClock,
        calendar: WorldCalendar,
        ids: FreshIds,
    ): ResourceService =
        ResourceService(world.executor, clock = { clock.instant() }, world = worldClock, calendar = calendar, ids = ids)

    /** One `Later` for the whole app: the gateway coalesces with it and a pledge waits out its span on it. */
    @Bean(destroyMethod = "close")
    fun later(): ScheduledLater = ScheduledLater()

    /** Gives a pledge back when its span is up. One wake-up a pledge, and none at all without one. */
    @Bean(destroyMethod = "close")
    fun pledges(
        world: InMemoryWorld,
        later: ScheduledLater,
        resources: ResourceService,
        worldClock: MonthlyWorldClock,
        clock: Clock,
        ids: FreshIds,
    ): Pledges = Pledges(world.feed, later, resources, worldClock, clock = { clock.instant() }, ids = ids)

    @Bean
    fun takeAction(world: InMemoryWorld, clock: Clock, worldClock: WorldClock): TakeActionService =
        TakeActionService(world.executor, clock = { clock.instant() }, world = worldClock)

    /** Chance, for whatever the world rolls. Never seeded from anything a client sends. */
    @Bean
    fun dice(): Dice = Dice { sides -> ThreadLocalRandom.current().nextInt(1, sides + 1) }

    /**
     * Adam's portraits, from the repository's `world/portraits/`, two directories above the one Gradle runs
     * the server in. `villages.portraits` points it somewhere else.
     */
    @Bean
    fun portraits(@Value("\${villages.portraits:../../world/portraits}") folder: String): Portraits =
        FolderPortraits(Path.of(folder))

    @Bean
    @Suppress("LongParameterList")
    fun keyFigures(
        world: InMemoryWorld,
        clock: Clock,
        worldClock: WorldClock,
        calendar: WorldCalendar,
        dice: Dice,
        portraits: Portraits,
    ): KeyFigureService = KeyFigureService(
        houses = world.executor,
        characters = world.characterExecutor,
        clock = { clock.instant() },
        world = worldClock,
        calendar = calendar,
        dice = dice,
        portraits = portraits,
    )

    /** Writes a character's death into every house that held them. See decision record 0055. */
    @Bean(destroyMethod = "close")
    fun mourning(world: InMemoryWorld, later: ScheduledLater, keyFigures: KeyFigureService): Mourning =
        Mourning(world.feed, later, keyFigures)

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
        mourning: Mourning,
    ): WorldWipe = WorldWipe {
        world.wipe().also {
            houses.reset()
            choices.reset()
            recentEvents.reset()
            mourning.reset()
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
        resources: ResourceService,
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
        resources = resources,
        choices = choices,
        recent = recentEvents,
        emptyTheWorld = worldWipe,
    )
}
