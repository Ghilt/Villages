package villages.app

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.AnonymousTokens
import villages.application.Arrival
import villages.application.BrokenRequirements
import villages.application.CharacterDeaths
import villages.application.DialogueService
import villages.application.Dice
import villages.application.FoundHouseService
import villages.application.FreshIds
import villages.application.fate.FateEngine
import villages.application.fate.GroundMaps
import villages.application.fate.WaterAt
import villages.application.fate.PlaceNamesByMaster
import villages.application.fate.FirstPools
import villages.application.fate.omenSources
import villages.application.fate.firstActions
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
import villages.application.TakeActionService
import villages.application.VisionService
import villages.application.WorldCalendar
import villages.application.WorldClock
import villages.application.WorldWipe
import villages.domain.WorldTime
import villages.gateway.Gateway
import villages.occurrent.InMemoryWorld
import villages.projections.CharactersProjection
import villages.projections.ChoicesProjection
import villages.projections.LastRollsProjection
import villages.projections.DialoguesProjection
import villages.projections.HousesProjection
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
 * The wiring. Everything the world is made of, chosen here and nowhere else: today the in-memory world,
 * because there is no MongoDB on this machine yet; from increment 0.8 a profile chooses between this and
 * the real store, and nothing that depends on the ports changes.
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

    /** The world, whose feed says on `faults` what its subscribers throw. */
    @Bean(destroyMethod = "close")
    fun world(faults: Faults): InMemoryWorld = InMemoryWorld(faults)

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
        world: InMemoryWorld,
        later: ScheduledLater,
        faults: Faults,
        resources: ResourceService,
        worldClock: MonthlyWorldClock,
        clock: Clock,
        ids: FreshIds,
    ): Pledges = Pledges(world.feed, later, faults, world.gate, resources, worldClock, clock = { clock.instant() }, ids = ids)

    /** Giving a house vision of a place outright, and taking it away. See decision record 0061. */
    @Bean
    fun visions(world: InMemoryWorld, clock: Clock, worldClock: WorldClock, ids: FreshIds): VisionService =
        VisionService(world.executor, clock = { clock.instant() }, world = worldClock, ids = ids)

    /**
     * Offering a house a dialogue, spoken by its key figures and showing its seat as the read models have them.
     * See decision 0071.
     */
    @Bean
    fun dialogues(
        world: InMemoryWorld,
        characters: CharactersProjection,
        houses: HousesProjection,
        clock: Clock,
        worldClock: WorldClock,
    ): DialogueService =
        DialogueService(world.executor, characters, houses, clock = { clock.instant() }, world = worldClock)

    @Bean
    fun takeAction(world: InMemoryWorld, clock: Clock, worldClock: WorldClock): TakeActionService =
        TakeActionService(world.executor, clock = { clock.instant() }, world = worldClock)

    /**
     * The choice roll: the fate engine over the first content and the omen sources there are, and the use case that
     * records what it deals. See decision record 0083.
     */
    @Bean
    @Suppress("LongParameterList")
    fun rolls(
        world: InMemoryWorld,
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
    ): RollService = RollService(
        FateEngine(
            omenSources(
                houses, characters, characters, sights, dialogueRows, lastRolls,
                months = { Calendar.monthOf(it.day) }, grounds = ground, housesNear = houses, names = names,
            ),
            FirstPools.ALL, firstActions(houses, ids), dice, ids,
        ),
        houses, world.executor, { clock.instant() }, worldClock, ids,
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

    /** Each master's real names, from the copy `world:names` files beside its ground map. See 0087. */
    @Bean
    fun placeNames(@Value("\${villages.ground:../../world/ground}") folder: String): PlaceNamesByMaster =
        FolderNames(Path.of(folder))

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
    @Bean(initMethod = "start", destroyMethod = "close")
    fun characterDeaths(
        world: InMemoryWorld,
        later: ScheduledLater,
        faults: Faults,
        keyFigures: KeyFigureService,
    ): CharacterDeaths = CharacterDeaths(world.feed, later, faults, world.gate, keyFigures)

    /** Carries a broken requirement to every house with a dialogue that needs it. See decision record 0071. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun brokenRequirements(
        world: InMemoryWorld,
        later: ScheduledLater,
        faults: Faults,
        clock: Clock,
        worldClock: WorldClock,
    ): BrokenRequirements = BrokenRequirements(world.feed, later, faults, world.gate, world.executor, { clock.instant() }, worldClock)

    /** The map's read model, folded from the feed. In memory, so it starts empty with the store. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun houses(world: InMemoryWorld): HousesProjection = HousesProjection(world.feed)

    /** What each player has been asked and has not answered, folded from the same feed. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun choices(world: InMemoryWorld): ChoicesProjection = ChoicesProjection(world.feed)

    /** The end of the chronicle, kept so the event viewer can show what happened before it opened. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun recentEvents(world: InMemoryWorld): RecentEventsProjection = RecentEventsProjection(world.feed)

    /** The characters, and which of them each house holds, folded from the same feed. See decision 0055. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun characters(world: InMemoryWorld): CharactersProjection = CharactersProjection(world.feed)

    /** What every house sees, worked out from where its seat and its people stand. See decision 0061. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun sights(world: InMemoryWorld): SightProjection = SightProjection(world.feed)

    /** What every house had at its last choice roll, which the next one's changes are measured against. See 0083. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun lastRolls(world: InMemoryWorld): LastRollsProjection = LastRollsProjection(world.feed)

    /** Every dialogue each house was offered, and how far each has got, folded from the same feed. See 0071. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun dialogueRows(world: InMemoryWorld): DialoguesProjection = DialoguesProjection(world.feed)

    /**
     * Emptying the development world: the store and everything folded from it, in one moment that nothing written
     * crosses, so that nothing is left holding a house whose events are gone. Everything is every `Resettable` there
     * is, so a read model or a listener added later is emptied without being named here. See decision record 0036.
     */
    @Bean
    fun worldWipe(world: InMemoryWorld, folded: List<Resettable>): WorldWipe = WorldWipe {
        world.wipe(folded)
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
        rolls: RollService,
        resources: ResourceService,
        worldWipe: WorldWipe,
        clock: Clock,
        worldClock: WorldClock,
        keyFigures: KeyFigureService,
        characters: CharactersProjection,
        sights: SightProjection,
        visions: VisionService,
        dialogues: DialogueService,
        dialogueRows: DialoguesProjection,
        stands: Stands,
        ground: GroundMaps,
        placeNames: PlaceNamesByMaster,
        faults: Faults,
        gatewayLater: ScheduledLater,
        gatewaySending: ExecutorService,
        @Value("\${villages.instruments:true}") instruments: Boolean,
    ): Gateway = Gateway(
        tokens = AnonymousTokens,
        foundHouse = foundHouse,
        events = world.feed,
        faults = faults,
        houses = houses,
        houseById = houses,
        theirHouses = houses,
        clock = clock,
        world = worldClock,
        arrival = arrival,
        takeAction = takeAction,
        rolls = rolls,
        resources = resources,
        choices = choices,
        recent = recentEvents,
        emptyTheWorld = worldWipe,
        keyFigures = keyFigures,
        figures = characters,
        onTheMap = characters,
        sights = sights,
        visions = visions,
        dialogues = dialogues,
        dialogueRows = dialogueRows,
        stands = stands,
        waters = WaterAt(ground, placeNames),
        later = gatewayLater,
        instrumentsOpen = instruments,
        sendOn = gatewaySending,
    )
}
