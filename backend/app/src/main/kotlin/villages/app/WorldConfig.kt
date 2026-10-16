package villages.app

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.Arrival
import villages.application.BrokenRequirements
import villages.application.CharacterDeaths
import villages.application.DialogueService
import villages.application.Dice
import villages.application.FoundHouseService
import villages.application.FreshIds
import villages.application.Islands
import villages.application.QuestObjectives
import villages.application.QuestService
import villages.application.fate.FateEngine
import villages.application.fate.GroundIslands
import villages.application.fate.GroundMaps
import villages.application.fate.PlaceNamesByMaster
import villages.application.fate.omenSources
import villages.application.fate.FateFromCatalogue
import villages.application.fate.RollService
import villages.application.KeyFigureService
import villages.application.FaultBoard
import villages.application.Faults
import villages.application.Later
import villages.application.MonthlyWorldClock
import villages.application.Pledges
import villages.application.Portraits
import villages.application.Resettable
import villages.application.Stands
import villages.application.ResourceService
import villages.application.ScheduledLater
import villages.application.Shelf
import villages.application.TakeActionService
import villages.application.VisionService
import villages.application.WorldCalendar
import villages.application.WorldClock
import villages.application.WorldWipe
import villages.domain.WorldTime
import villages.occurrent.EventWorld
import villages.projections.CharactersProjection
import villages.projections.ChoicesProjection
import villages.projections.LastRollsProjection
import villages.projections.DialoguesProjection
import villages.projections.HousesProjection
import villages.projections.QuestsProjection
import villages.projections.RecentEventsProjection
import villages.projections.SightProjection
import villages.protocol.Calendar
import java.nio.file.Path
import java.time.Clock
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.ThreadLocalRandom
import java.util.concurrent.atomic.AtomicInteger

private val feedLog = LoggerFactory.getLogger("villages.feed")

/**
 * The wiring. Everything the world is made of, chosen here and nowhere else, but for where its events are kept,
 * which `StoreConfig` chooses: nothing here can tell whether that is memory or MongoDB.
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

    @Bean
    fun foundHouse(world: EventWorld, clock: Clock, worldClock: WorldClock): FoundHouseService =
        FoundHouseService(world.executor, clock = { clock.instant() }, world = worldClock)

    /** Message ids. Aggregate identities are derived and never come from here; see decision 0035. */
    @Bean
    fun freshIds(): FreshIds = FreshIds { UUID.randomUUID() }

    /** What happens when a player arrives: with no house and nothing pending, they are asked where. */
    @Bean
    fun arrival(world: EventWorld, clock: Clock, worldClock: WorldClock, ids: FreshIds): Arrival =
        Arrival(world.executor, clock = { clock.instant() }, world = worldClock, ids = ids)

    @Bean
    fun resources(
        world: EventWorld,
        clock: Clock,
        worldClock: WorldClock,
        calendar: WorldCalendar,
        ids: FreshIds,
    ): ResourceService =
        ResourceService(world.executor, clock = { clock.instant() }, world = worldClock, calendar = calendar, ids = ids)

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
     * and a read model's watcher only ever queues. A thread a socket that is sending, made as wanted and let go when
     * idle; a send that never finishes is ended by Tomcat's own timeout. Without this bean's line in the gateway's
     * wiring, frames are sent on whatever thread queued them, as they were before. See decision record 0077.
     */
    @Bean(destroyMethod = "shutdownNow")
    fun gatewaySending(): ExecutorService {
        val made = AtomicInteger()
        return Executors.newCachedThreadPool { runnable ->
            Thread(runnable, "villages-sending-${made.incrementAndGet()}").apply { isDaemon = true }
        }
    }

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

    /** Giving a house vision of a place outright, and taking it away. See decision record 0061. */
    @Bean
    fun visions(world: EventWorld, clock: Clock, worldClock: WorldClock, ids: FreshIds): VisionService =
        VisionService(world.executor, clock = { clock.instant() }, world = worldClock, ids = ids)

    /**
     * Offering a house a dialogue, spoken by its key figures and showing its seat as the read models have them.
     * See decision 0071.
     */
    @Bean
    fun dialogues(
        world: EventWorld,
        characters: CharactersProjection,
        houses: HousesProjection,
        clock: Clock,
        worldClock: WorldClock,
        shelf: Shelf,
    ): DialogueService =
        DialogueService(world.executor, characters, houses, clock = { clock.instant() }, world = worldClock) { shelf.dialogues }

    /** Offering a house a quest. See decision record 0096. */
    @Bean
    fun quests(
        world: EventWorld,
        clock: Clock,
        worldClock: WorldClock,
        calendar: WorldCalendar,
        ids: FreshIds,
        questRows: QuestsProjection,
    ): QuestService = QuestService(world.executor, { clock.instant() }, worldClock, calendar, ids, questRows)

    @Bean
    fun takeAction(world: EventWorld, clock: Clock, worldClock: WorldClock): TakeActionService =
        TakeActionService(world.executor, clock = { clock.instant() }, world = worldClock)

    /**
     * The choice roll: the fate engine over the first content and the omen sources there are, and the use case that
     * records what it deals. See decision record 0083.
     */
    @Bean
    @Suppress("LongParameterList")
    fun rolls(
        world: EventWorld,
        houses: HousesProjection,
        characters: CharactersProjection,
        sights: SightProjection,
        dialogueRows: DialoguesProjection,
        lastRolls: LastRollsProjection,
        ground: GroundMaps,
        names: PlaceNamesByMaster,
        clock: Clock,
        worldClock: WorldClock,
        dice: Dice,
        ids: FreshIds,
        shelf: Shelf,
    ): RollService = RollService(
        FateEngine(
            omenSources(
                houses, characters, characters, sights, dialogueRows, lastRolls,
                months = { Calendar.monthOf(it.day) }, grounds = ground, housesNear = houses, names = names,
                balance = { shelf.balance },
            ),
            FateFromCatalogue({ shelf.fate }, houses, ids) { shelf.balance }, dice, ids, { shelf.balance },
        ),
        houses, world.executor, { clock.instant() }, worldClock, ids, { shelf.balance },
    )

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

    /**
     * The scenery's stands, from the folder the world generator writes them to and nothing serves, two
     * directories above the one Gradle runs the server in, as the portraits are. `villages.stands` points it
     * somewhere else. See decision record 0067.
     */
    @Bean
    fun stands(@Value("\${villages.stands:../../world/stands}") folder: String): Stands =
        FolderStands(Path.of(folder))

    /** Each master's ground map, from the folder `world:ground` writes, as the stands are. See 0084. */
    @Bean
    fun ground(@Value("\${villages.ground:../../world/ground}") folder: String): GroundMaps =
        FolderGround(Path.of(folder))

    /** Which land is an island, read off the ground of the world's master. See decision record 0096. */
    @Bean
    fun islands(ground: GroundMaps, @Value("\${villages.master:$WORLD_MASTER}") master: String, shelf: Shelf): Islands =
        GroundIslands(ground, master) { shelf.balance }

    /** Each master's real names, from the copy `world:names` files beside its ground map. See 0087. */
    @Bean
    fun placeNames(@Value("\${villages.ground:../../world/ground}") folder: String): PlaceNamesByMaster =
        FolderNames(Path.of(folder))

    @Bean
    @Suppress("LongParameterList")
    fun keyFigures(
        world: EventWorld,
        clock: Clock,
        worldClock: WorldClock,
        calendar: WorldCalendar,
        dice: Dice,
        portraits: Portraits,
        shelf: Shelf,
    ): KeyFigureService = KeyFigureService(
        houses = world.executor,
        characters = world.characterExecutor,
        clock = { clock.instant() },
        world = worldClock,
        calendar = calendar,
        dice = dice,
        portraits = portraits,
        balance = { shelf.balance },
        names = { shelf.characterNames },
    )

    /** Writes a character's death into every house that held them. See decision record 0055. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun characterDeaths(
        world: EventWorld,
        later: ScheduledLater,
        faults: Faults,
        keyFigures: KeyFigureService,
    ): CharacterDeaths = CharacterDeaths(world.storeFeed, later, faults, world.gate, keyFigures)

    /** Carries a broken requirement to every house with a dialogue that needs it. See decision record 0071. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun brokenRequirements(
        world: EventWorld,
        later: ScheduledLater,
        faults: Faults,
        clock: Clock,
        worldClock: WorldClock,
    ): BrokenRequirements = BrokenRequirements(world.storeFeed, later, faults, world.gate, world.executor, { clock.instant() }, worldClock)

    /** Ticks a quest's objective when the world meets it: a structure held, anywhere or on an island. See 0096. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun questObjectives(
        world: EventWorld,
        later: ScheduledLater,
        faults: Faults,
        clock: Clock,
        worldClock: WorldClock,
        islands: Islands,
    ): QuestObjectives =
        QuestObjectives(world.storeFeed, later, faults, world.gate, world.executor, { clock.instant() }, worldClock, islands)

    /** The map's read model, folded from the feed. In memory, so it starts empty with the store. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun houses(world: EventWorld): HousesProjection = HousesProjection(world.feed)

    /** What each player has been asked and has not answered, folded from the same feed. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun choices(world: EventWorld): ChoicesProjection = ChoicesProjection(world.feed)

    /** The end of the chronicle, kept so the event viewer can show what happened before it opened. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun recentEvents(world: EventWorld): RecentEventsProjection = RecentEventsProjection(world.feed)

    /** The characters, and which of them each house holds, folded from the same feed. See decision 0055. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun characters(world: EventWorld): CharactersProjection = CharactersProjection(world.feed)

    /** What every house sees, worked out from where its seat and its people stand. See decision 0061. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun sights(world: EventWorld): SightProjection = SightProjection(world.feed)

    /** What every house had at its last choice roll, which the next one's changes are measured against. See 0083. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun lastRolls(world: EventWorld): LastRollsProjection = LastRollsProjection(world.feed)

    /** Every dialogue each house was offered, and how far each has got, folded from the same feed. See 0071. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun dialogueRows(world: EventWorld): DialoguesProjection = DialoguesProjection(world.feed)

    /** Every quest each house was offered, and what it recorded of each, folded from the same feed. See 0096. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun questRows(world: EventWorld): QuestsProjection = QuestsProjection(world.feed)

    /**
     * Emptying the development world: the store and everything folded from it, in one moment that nothing written
     * crosses, so that nothing is left holding a house whose events are gone. Everything is every `Resettable` there
     * is, so a read model or a listener added later is emptied without being named here. See decision record 0036.
     * The emptied world then records the catalogues it runs on, as a fresh one does when the server starts (0097).
     */
    @Bean
    fun worldWipe(world: EventWorld, folded: List<Resettable>, shelf: Shelf): WorldWipe = WorldWipe {
        world.wipe(folded).also { shelf.recordAll() }
    }
}
