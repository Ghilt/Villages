package villages.app

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.Catalogues
import villages.application.ChallengeSimulator
import villages.application.Seeds
import villages.application.Shelf
import villages.gateway.ChallengesMechanic
import villages.gateway.GatewayMechanic
import java.util.concurrent.ThreadLocalRandom

/**
 * The challenge: its engine fought for Adam's simulator on the catalogue and the balance in force, and its place in the
 * gateway, an instrument. Not in the game yet. See decision record 0107. One mechanic's beans in a configuration of
 * its own, so a mechanic is wired where it is: see `docs/plans/mechanic-modules.md`, step 4.
 */
@Configuration
class ChallengesConfig {
    @Bean
    fun challengeSimulator(shelf: Shelf): ChallengeSimulator =
        ChallengeSimulator({ shelf.challenges }, { shelf.balance.challenge }) { ThreadLocalRandom.current().nextLong(0, Seeds.MOST + 1) }

    /** The challenge's place in the gateway: the simulator's page has the engine fight a challenge out. See 0107. */
    @Bean
    fun challengesInTheGateway(simulator: ChallengeSimulator, shelf: Shelf): GatewayMechanic =
        ChallengesMechanic(simulator) { shelf.fingerprints()[Catalogues.CHALLENGES].orEmpty() }
}
