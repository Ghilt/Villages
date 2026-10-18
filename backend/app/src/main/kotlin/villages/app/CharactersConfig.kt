package villages.app

import villages.gateway.GatewayMechanic
import villages.gateway.KeyFiguresMechanic
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.CharacterDeaths
import villages.application.Dice
import villages.application.KeyFigureService
import villages.application.Faults
import villages.application.Portraits
import villages.application.ScheduledLater
import villages.application.Shelf
import villages.application.WorldCalendar
import villages.application.WorldClock
import villages.occurrent.EventWorld
import villages.projections.CharactersProjection
import java.time.Clock

/**
 * Characters and key figures: the people, a death written into every house that held them. See decision record 0055.
 * One mechanic's beans in a configuration of its own, so a mechanic is wired where it is: see
 * `docs/plans/mechanic-modules.md`, step 4.
 */
@Configuration
class CharactersConfig {
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

    /** The characters, and which of them each house holds, folded from the same feed. See decision 0055. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun characters(world: EventWorld): CharactersProjection = CharactersProjection(world.feed)

    /** The key figures' place in the gateway: their part, and Adam's levers for a house's people. See 0055. */
    @Bean
    fun keyFiguresInTheGateway(characters: CharactersProjection, keyFigures: KeyFigureService): GatewayMechanic =
        KeyFiguresMechanic(characters, characters, keyFigures)
}
