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
import villages.application.Stands
import villages.application.StructureCommandExecutor
import villages.application.WorldClock
import villages.application.bots.HouseBotPlace
import villages.application.bots.HouseBotPlaces
import villages.application.bots.HouseBots
import villages.application.fate.GroundMaps
import villages.application.fate.PlaceNamesByMaster
import villages.application.settlements.PlacesNear
import villages.application.settlements.SettlementSite
import villages.application.settlements.SettlementSites
import villages.application.settlements.Settlements
import villages.domain.Location
import villages.occurrent.EventWorld
import villages.projections.StructuresProjection
import java.nio.file.Files
import java.nio.file.Path
import java.time.Clock

private val openingLog = LoggerFactory.getLogger("villages.opening")

/**
 * The opening, and the house bots and the settlements it makes: what the game server does when a world begins - as
 * it starts, here, and after a wipe and after a load, where those are wired. The bots and the settlements are the
 * world's and not levers, so the instruments do not gate them; `villages.house-bots=false` and
 * `villages.settlements=false` leave them out, which the tests that start a server do. See decision records 0108 and
 * 0114.
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
        structures: StructureCommandExecutor,
        onTheMap: StructuresProjection,
        sites: SettlementSites,
        @Value("\${villages.settlements:true}") settlements: Boolean,
        stands: Stands,
    ): Opening {
        // A bot's seat keeps as clear of a settlement's site and of a road as a settlement keeps of a seat.
        val bots = {
            val clear = shelf.balance.settlements.clearKm
            val near = PlacesNear(if (settlements) sitesOn(master, sites).map { it.place } else emptyList(), clear)
            val roads = RoadsNear(stands, master)
            placesOn(master, ground, names, Path.of(ruins), shelf.balance.houseBots) {
                near.within(it) || roads.within(it, clear)
            }
        }
        return Opening(
            recordCatalogues = { shelf.recordAll() },
            houseBots = HouseBots(
                world = world.worldExecutor(CatalogueDiff::changes),
                houses = foundHouse,
                places = bots,
                clock = { clock.instant() },
                worldClock = worldClock,
            ).takeIf { houseBots },
            settlements = Settlements(
                structures = structures,
                standing = onTheMap,
                sites = { sitesOn(master, sites) },
                seats = { if (houseBots) bots().map { it.seat } else emptyList() },
                clearKm = { shelf.balance.settlements.clearKm },
                clock = { clock.instant() },
                world = worldClock,
            ).takeIf { settlements },
        )
    }

    /** The world opened once everything is wired and following the feed. */
    @Bean
    fun openTheWorld(opening: Opening): ApplicationRunner = ApplicationRunner { opening.openAndSay() }
}

/** Opens the world, and says in the log what the opening did and how long it took. */
internal fun Opening.openAndSay(): Opening.Opened {
    val started = System.nanoTime()
    val opened = open()
    val seconds = (System.nanoTime() - started) / 1e9
    val settlements = opened.settlements
    if (settlements == null) {
        openingLog.info("the world is open, with {} house bots, in {} s", opened.bots, "%.1f".format(seconds))
    } else {
        openingLog.info(
            "the world is open, with {} house bots and {} settlement sites: {} of their buildings raised, {} sites passed over for a seat, in {} s",
            opened.bots, settlements.sites, settlements.raised, settlements.passedOver, "%.1f".format(seconds),
        )
    }
    return opened
}

/** The settlement sites of the world's master, none and a line in the log when a tree has not chosen them yet. */
private fun sitesOn(master: String, sites: SettlementSites) =
    sites.of(master) ?: emptyList<SettlementSite>().also {
        openingLog.warn("no settlements: the master {} has no sites; npm run world:ready --prefix frontend", master)
    }

/**
 * Where the bots of the world's master stand, read off its ground, its names and the ruins as they are on disk now;
 * none, and a line in the log, when a tree has not made them yet.
 */
private fun placesOn(
    master: String,
    ground: GroundMaps,
    names: PlaceNamesByMaster,
    ruins: Path,
    bots: Balance.HouseBots,
    keepClear: (Location) -> Boolean,
): List<HouseBotPlace> {
    val map = ground.of(master)
    val named = names.of(master)
    if (map == null || named == null || !Files.isRegularFile(ruins)) {
        openingLog.warn("no house bots: the master {} has no ground or names, or there is no {}", master, ruins)
        return emptyList()
    }
    return HouseBotPlaces.of(named.names, map, RuinsFile.parse(Files.readString(ruins)), bots, keepClear)
}
