package villages.app

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.AnonymousTokens
import villages.application.Antarctica
import villages.application.Arrival
import villages.application.Faults
import villages.application.FoundHouseService
import villages.application.KeyFigureService
import villages.application.ResourceService
import villages.application.ScheduledLater
import villages.application.Stands
import villages.application.StructureService
import villages.application.TakeActionService
import villages.application.VisionService
import villages.application.WorldClock
import villages.application.WorldSaves
import villages.application.WorldWipe
import villages.application.fate.GroundMaps
import villages.application.fate.PlaceNamesByMaster
import villages.application.fate.RollService
import villages.application.fate.WaterAt
import villages.application.Shelf
import villages.gateway.Gateway
import villages.gateway.GatewayMechanic
import villages.gateway.Mechanics
import villages.occurrent.EventWorld
import villages.projections.CharactersProjection
import villages.projections.ChoicesProjection
import villages.projections.HousesProjection
import villages.projections.RecentEventsProjection
import villages.projections.SightProjection
import villages.projections.StructuresProjection
import java.time.Clock
import java.util.concurrent.ExecutorService

/**
 * The gateway, wired: the core and every mechanic's part, made from the ports each mechanic reads or acts through.
 * A configuration of its own rather than the last bean of `WorldConfig`, because the gateway takes a port or two for
 * every mechanic there is and `WorldConfig` was near its size ceiling (0072). See decision record 0075.
 */
@Configuration
class GatewayConfig {
    @Bean(destroyMethod = "close")
    @Suppress("LongParameterList")
    fun gateway(
        world: EventWorld,
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
        stands: Stands,
        ground: GroundMaps,
        placeNames: PlaceNamesByMaster,
        faults: Faults,
        gatewayLater: ScheduledLater,
        gatewaySending: ExecutorService,
        structures: StructureService,
        antarctica: Antarctica,
        structuresOnTheMap: StructuresProjection,
        shelf: Shelf,
        saves: WorldSaves,
        own: List<GatewayMechanic>,
        @Value("\${villages.instruments:true}") instruments: Boolean,
    ): Gateway = Gateway(
        tokens = AnonymousTokens,
        faults = faults,
        houses = houses,
        clock = clock,
        world = worldClock,
        onTheMap = characters,
        structures = structuresOnTheMap,
        mechanics = Mechanics(
            foundHouse = foundHouse,
            events = world.feed,
            houseById = houses,
            theirHouses = houses,
            arrival = arrival,
            takeAction = takeAction,
            rolls = rolls,
            resources = resources,
            choices = choices,
            recent = recentEvents,
            emptyTheWorld = worldWipe,
            keyFigures = keyFigures,
            figures = characters,
            sights = sights,
            visions = visions,
            stands = stands,
            waters = WaterAt(ground, placeNames),
            structures = structures,
            antarctica = antarctica,
            instrumentsOpen = instruments,
            worldKept = world,

            structureCatalogue = { shelf.structures },
            catalogues = shelf,
            saves = saves,
            everyHouse = houses,
            characterById = characters,
        ),
        later = gatewayLater,
        sendOn = gatewaySending,
        own = own,
    )
}
