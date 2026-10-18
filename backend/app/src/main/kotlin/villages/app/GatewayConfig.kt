package villages.app

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.AnonymousTokens
import villages.application.Antarctica
import villages.application.Faults
import villages.application.ScheduledLater
import villages.application.Stands
import villages.application.WorldClock
import villages.application.WorldSaves
import villages.application.WorldWipe
import villages.application.fate.GroundMaps
import villages.application.fate.PlaceNamesByMaster
import villages.application.fate.WaterAt
import villages.application.Shelf
import villages.gateway.Gateway
import villages.gateway.GatewayMechanic
import villages.gateway.Mechanics
import villages.occurrent.EventWorld
import villages.projections.CharactersProjection
import villages.projections.HousesProjection
import villages.projections.RecentEventsProjection
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
        houses: HousesProjection,
        recentEvents: RecentEventsProjection,
        worldWipe: WorldWipe,
        clock: Clock,
        worldClock: WorldClock,
        characters: CharactersProjection,
        stands: Stands,
        ground: GroundMaps,
        placeNames: PlaceNamesByMaster,
        faults: Faults,
        gatewayLater: ScheduledLater,
        gatewaySending: ExecutorService,
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
            events = world.feed,
            houseById = houses,
            recent = recentEvents,
            emptyTheWorld = worldWipe,
            stands = stands,
            waters = WaterAt(ground, placeNames),
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
