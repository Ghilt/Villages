package villages.app

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.Catalogues
import villages.application.ChallengeMatchups
import villages.application.ChallengeSimulator
import villages.application.Seeds
import villages.application.Shelf
import villages.gateway.ChallengeHistoryMechanic
import villages.gateway.ChallengesMechanic
import villages.gateway.GatewayMechanic
import villages.occurrent.EventWorld
import villages.projections.ChallengesProjection
import java.util.concurrent.ThreadLocalRandom

/**
 * The challenge: its engine fought for Adam's simulator on the catalogue and the balance in force, and its place in the
 * gateway, an instrument; and in the game, the history of every challenge each house fought, folded and sent to its
 * player. A quest's challenge is accepted through the quests' wiring. See decision record 0107, amended. One mechanic's beans in a configuration of
 * its own, so a mechanic is wired where it is: see `docs/plans/mechanic-modules.md`, step 4.
 */
@Configuration
class ChallengesConfig {
    @Bean
    fun challengeSimulator(shelf: Shelf): ChallengeSimulator =
        ChallengeSimulator({ shelf.challenges }, { shelf.balance.challenge }) { ThreadLocalRandom.current().nextLong(0, Seeds.MOST + 1) }

    /** Every aspect weighed against every other, for the simulator's grid of matchups. See 0107. */
    @Bean
    fun challengeMatchups(shelf: Shelf): ChallengeMatchups =
        ChallengeMatchups({ shelf.challenges }, { shelf.balance.challenge }) { ThreadLocalRandom.current().nextLong(0, Seeds.MOST + 1) }

    /** Every challenge each house fought, folded from the feed: the history its player is sent. See 0107, amended. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun challengeRows(world: EventWorld): ChallengesProjection = ChallengesProjection(world.feed)

    /** The history's place in the gateway: every challenge a house fought, sent to its player. See 0107, amended. */
    @Bean
    fun challengeHistoryInTheGateway(challengeRows: ChallengesProjection): GatewayMechanic = ChallengeHistoryMechanic(challengeRows)

    /** The challenge's place in the gateway: the simulator's page has the engine fight a challenge out. See 0107. */
    @Bean
    fun challengesInTheGateway(simulator: ChallengeSimulator, matchups: ChallengeMatchups, shelf: Shelf): GatewayMechanic =
        ChallengesMechanic(simulator, matchups) { shelf.fingerprints()[Catalogues.CHALLENGES].orEmpty() }
}
