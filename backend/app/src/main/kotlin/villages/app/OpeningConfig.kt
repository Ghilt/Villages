package villages.app

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.Balance
import villages.application.FoundHouseService
import villages.application.Opening
import villages.application.Shelf
import villages.application.WorldClock
import villages.application.bots.HouseBotPlace
import villages.application.bots.HouseBotPlaces
import villages.application.bots.HouseBots
import villages.application.fate.GroundMaps
import villages.application.fate.PlaceNamesByMaster
import villages.occurrent.EventWorld
import java.nio.file.Files
import java.nio.file.Path
import java.time.Clock

private val openingLog = LoggerFactory.getLogger("villages.opening")

/**
 * The opening, and the house bots it makes: what the game server does when a world begins - as it starts, here, and
 * after a wipe and after a load, where those are wired. The bots are the world's and not a lever, so the instruments
 * do not gate them; `villages.house-bots=false` leaves them out, which the tests that start a server do. See decision
 * record 0108.
 */
@Configuration
class OpeningConfig {
    @Bean
    fun opening(
        world: EventWorld,
        shelf: Shelf,
        foundHouse: FoundHouseService,
        ground: GroundMaps,
        names: PlaceNamesByMaster,
        clock: Clock,
        worldClock: WorldClock,
        @Value("\${villages.master:$WORLD_MASTER}") master: String,
        @Value("\${villages.ruins:../../world/ruins.json}") ruins: String,
        @Value("\${villages.house-bots:true}") houseBots: Boolean,
    ): Opening = Opening(
        recordCatalogues = { shelf.recordAll() },
        houseBots = HouseBots(
            world = world.worldExecutor(CatalogueDiff::changes),
            houses = foundHouse,
            places = { placesOn(master, ground, names, Path.of(ruins), shelf.balance.houseBots) },
            clock = { clock.instant() },
            worldClock = worldClock,
        ).takeIf { houseBots },
    )

    /** The world opened once everything is wired and following the feed. */
    @Bean
    fun openTheWorld(opening: Opening): ApplicationRunner = ApplicationRunner {
        openingLog.info("the world is open, with {} house bots", opening.open())
    }
}

/**
 * Where the bots of the world's master stand, read off its ground, its names and the ruins as they are on disk now;
 * none, and a line in the log, when a tree has not made them yet.
 */
private fun placesOn(master: String, ground: GroundMaps, names: PlaceNamesByMaster, ruins: Path, bots: Balance.HouseBots): List<HouseBotPlace> {
    val map = ground.of(master)
    val named = names.of(master)
    if (map == null || named == null || !Files.isRegularFile(ruins)) {
        openingLog.warn("no house bots: the master {} has no ground or names, or there is no {}", master, ruins)
        return emptyList()
    }
    return HouseBotPlaces.of(named.names, map, RuinsFile.parse(Files.readString(ruins)), bots)
}
