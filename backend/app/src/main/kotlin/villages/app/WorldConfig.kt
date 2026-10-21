package villages.app

import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.Dice
import villages.application.FreshIds
import villages.application.FaultBoard
import villages.application.Faults
import villages.application.Later
import villages.application.MonthlyWorldClock
import villages.application.Opening
import villages.application.Resettable
import villages.application.ScheduledLater
import villages.application.WorldCalendar
import villages.application.WorldWipe
import villages.domain.WorldTime
import villages.occurrent.EventWorld
import villages.projections.RecentEventsProjection
import villages.protocol.Calendar
import java.time.Clock
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.ThreadLocalRandom

private val feedLog = LoggerFactory.getLogger("villages.feed")

/**
 * The wiring every mechanic shares: the clocks, the ids, chance, what acts later, the gateway's threads, the chronicle
 * and the wipe. Each mechanic's own beans are in a configuration of its own beside this - `HousesConfig`,
 * `QuestsConfig` and the rest - and where its events are kept is `StoreConfig`'s: nothing here can tell whether that is
 * memory or MongoDB. See `docs/plans/mechanic-modules.md`, step 4.
 */
@Configuration
class WorldConfig {
    /**
     * Where anything acting on its own says it threw - a subscriber to the feed, a listener, something
     * scheduled for later - and where the server's log hears of it: the stack is written here, and the gateway
     * tells every window the one line of it. See decision 0029.
     */
    @Bean
    fun faults(): FaultBoard = FaultBoard().also { board ->
        board.watch { fault -> feedLog.error(fault.describe(), fault.thrown) }
    }

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

    /** Message ids. Aggregate identities are derived and never come from here; see decision 0035. */
    @Bean
    fun freshIds(): FreshIds = FreshIds { UUID.randomUUID() }

    /** The `Later` of what acts on its own: a pledge waits out its span on it, and a listener acts on it. */
    @Bean(destroyMethod = "close")
    fun later(faults: Faults): ScheduledLater = ScheduledLater(faults)

    /**
     * The gateway's own `Later`, which it coalesces its frames on. Its own on purpose, so that batching for every
     * connection never holds up a pledge coming back; a batch is only queued here, and sent on `gatewaySending`.
     */
    @Bean(destroyMethod = "close")
    fun gatewayLater(faults: Faults): ScheduledLater = ScheduledLater(faults, "villages-gateway")

    /**
     * The threads the gateway sends frames on, so that a slow socket holds up its own connection and nobody else's,
     * and a read model's watcher only ever queues. A virtual thread a send, which a socket that will not take a frame
     * parks rather than holds; a send that never finishes is ended by Tomcat's own timeout. Without this bean's line in
     * the gateway's wiring, frames are sent on whatever thread queued them, as they were before. See decision record
     * 0077. It needs Java 24 or later: on 21 a send blocked inside Tomcat's own write pinned its carrier, and past forty
     * connections the server answered nobody (experiment 0023); `SocketCrowdTest` holds it to two hundred at once.
     */
    @Bean(destroyMethod = "shutdownNow")
    fun gatewaySending(): ExecutorService =
        Executors.newThreadPerTaskExecutor(Thread.ofVirtual().name("villages-sending-", 1).factory())

    /** Chance, for whatever the world rolls. Never seeded from anything a client sends. */
    @Bean
    fun dice(): Dice = Dice { sides -> ThreadLocalRandom.current().nextInt(1, sides + 1) }

    /** The end of the chronicle, kept so the event viewer can show what happened before it opened. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun recentEvents(world: EventWorld): RecentEventsProjection = RecentEventsProjection(world.feed)

    /**
     * Emptying the development world: the store and everything folded from it, in one moment that nothing written
     * crosses, so that nothing is left holding a house whose events are gone. Everything is every `Resettable` there
     * is, so a read model or a listener added later is emptied without being named here. See decision record 0036.
     * The emptied world is then opened, as a fresh one is when the server starts: it records the catalogues it runs on
     * and makes its house bots and raises its settlements again (0097, 0108, 0114).
     */
    @Bean
    fun worldWipe(world: EventWorld, folded: List<Resettable>, opening: Opening): WorldWipe = WorldWipe {
        world.wipe(folded).also { opening.openAndSay() }
    }
}
