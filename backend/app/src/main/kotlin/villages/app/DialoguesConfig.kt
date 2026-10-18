package villages.app

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.gateway.DialoguesMechanic
import villages.gateway.GatewayMechanic
import villages.application.BrokenRequirements
import villages.application.DialogueService
import villages.application.Faults
import villages.application.ScheduledLater
import villages.application.Shelf
import villages.application.WorldClock
import villages.occurrent.EventWorld
import villages.projections.CharactersProjection
import villages.projections.DialoguesProjection
import villages.projections.HousesProjection
import java.time.Clock

/**
 * Dialogues: offered to a house, carried a broken requirement, and folded. See decision record 0071.
 * One mechanic's beans in a configuration of its own, so a mechanic is wired where it is: see
 * `docs/plans/mechanic-modules.md`, step 4.
 */
@Configuration
class DialoguesConfig {
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

    /** Carries a broken requirement to every house with a dialogue that needs it. See decision record 0071. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun brokenRequirements(
        world: EventWorld,
        later: ScheduledLater,
        faults: Faults,
        clock: Clock,
        worldClock: WorldClock,
    ): BrokenRequirements = BrokenRequirements(world.storeFeed, later, faults, world.gate, world.executor, { clock.instant() }, worldClock)

    /** Every dialogue each house was offered, and how far each has got, folded from the same feed. See 0071. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun dialogueRows(world: EventWorld): DialoguesProjection = DialoguesProjection(world.feed)

    /** The dialogues' place in the gateway: their part, and the lever that offers one. See decision record 0071. */
    @Bean
    fun dialoguesInTheGateway(dialogues: DialogueService, dialogueRows: DialoguesProjection): GatewayMechanic =
        DialoguesMechanic(dialogues, dialogueRows)
}
