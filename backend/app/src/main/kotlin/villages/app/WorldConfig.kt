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
import villages.application.KeyFigureService
import villages.application.FaultBoard
import villages.application.Faults
import villages.application.Later
import villages.application.MonthlyWorldClock
import villages.application.Pledges
import villages.application.Portraits
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
import villages.projections.DialoguesProjection
import villages.projections.HousesProjection
import villages.projections.RecentEventsProjection
import villages.projections.SightProjection
import villages.protocol.Calendar
import java.nio.file.Path
import java.time.Clock
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ThreadLocalRandom

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
     * The gateway's own `Later`, which it coalesces its frames on. Its own on purpose: a flush writes to sockets,
     * and a slow one must never hold up a pledge coming back.
     */
    @Bean(destroyMethod = "close")
    fun gatewayLater(faults: Faults): ScheduledLater = ScheduledLater(faults, "villages-gateway")

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
    fun characterDeaths(world: InMemoryWorld, later: ScheduledLater, keyFigures: KeyFigureService): CharacterDeaths =
        CharacterDeaths(world.feed, later, keyFigures)

    /** Carries a broken requirement to every house with a dialogue that needs it. See decision record 0071. */
    @Bean(destroyMethod = "close")
    fun brokenRequirements(
        world: InMemoryWorld,
        later: ScheduledLater,
        clock: Clock,
        worldClock: WorldClock,
    ): BrokenRequirements = BrokenRequirements(world.feed, later, world.executor, { clock.instant() }, worldClock)

    /** The map's read model, folded from the feed. In memory, so it starts empty with the store. */
    @Bean(destroyMethod = "close")
    fun houses(world: InMemoryWorld): HousesProjection = HousesProjection(world.feed)

    /** What each player has been asked and has not answered, folded from the same feed. */
    @Bean(destroyMethod = "close")
    fun choices(world: InMemoryWorld): ChoicesProjection = ChoicesProjection(world.feed)

    /** The end of the chronicle, kept so the event viewer can show what happened before it opened. */
    @Bean(destroyMethod = "close")
    fun recentEvents(world: InMemoryWorld): RecentEventsProjection = RecentEventsProjection(world.feed)

    /** The characters, and which of them each house holds, folded from the same feed. See decision 0055. */
    @Bean(destroyMethod = "close")
    fun characters(world: InMemoryWorld): CharactersProjection = CharactersProjection(world.feed)

    /** What every house sees, worked out from where its seat and its people stand. See decision 0061. */
    @Bean(destroyMethod = "close")
    fun sights(world: InMemoryWorld): SightProjection = SightProjection(world.feed)

    /** Every dialogue each house was offered, and how far each has got, folded from the same feed. See 0071. */
    @Bean(destroyMethod = "close")
    fun dialogueRows(world: InMemoryWorld): DialoguesProjection = DialoguesProjection(world.feed)

    /**
     * Emptying the development world: the store and every read model folded from it, in one act, so that
     * no projection is left holding a house whose events are gone. See decision record 0036.
     */
    @Bean
    @Suppress("LongParameterList")
    fun worldWipe(
        world: InMemoryWorld,
        houses: HousesProjection,
        choices: ChoicesProjection,
        recentEvents: RecentEventsProjection,
        characters: CharactersProjection,
        sights: SightProjection,
        dialogueRows: DialoguesProjection,
        characterDeaths: CharacterDeaths,
        brokenRequirements: BrokenRequirements,
    ): WorldWipe = WorldWipe {
        world.wipe().also {
            houses.reset()
            choices.reset()
            recentEvents.reset()
            characters.reset()
            sights.reset()
            dialogueRows.reset()
            characterDeaths.reset()
            brokenRequirements.reset()
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
        keyFigures: KeyFigureService,
        characters: CharactersProjection,
        sights: SightProjection,
        visions: VisionService,
        dialogues: DialogueService,
        dialogueRows: DialoguesProjection,
        stands: Stands,
        faults: Faults,
        gatewayLater: ScheduledLater,
    ): Gateway = Gateway(
        tokens = AnonymousTokens,
        foundHouse = foundHouse,
        events = world.feed,
        faults = faults,
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
        keyFigures = keyFigures,
        figures = characters,
        onTheMap = characters,
        sights = sights,
        visions = visions,
        dialogues = dialogues,
        dialogueRows = dialogueRows,
        stands = stands,
        later = gatewayLater,
    )
}
