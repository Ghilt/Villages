package villages.app

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.gateway.GatewayMechanic
import villages.gateway.QuestsMechanic
import villages.application.FreshIds
import villages.application.Islands
import villages.application.QuestObjectives
import villages.application.QuestService
import villages.application.Faults
import villages.application.ScheduledLater
import villages.application.Shelf
import villages.application.WorldCalendar
import villages.application.WorldClock
import villages.occurrent.EventWorld
import villages.projections.QuestsProjection
import java.time.Clock

/**
 * Quests: offered to a house, ticked when the world meets an objective, and folded. See decision record 0096.
 * One mechanic's beans in a configuration of its own, so a mechanic is wired where it is: see
 * `docs/plans/mechanic-modules.md`, step 4.
 */
@Configuration
class QuestsConfig {
    /** Offering a house a quest. See decision record 0096. */
    @Bean
    fun quests(
        world: EventWorld,
        clock: Clock,
        worldClock: WorldClock,
        calendar: WorldCalendar,
        ids: FreshIds,
        questRows: QuestsProjection,
        shelf: Shelf,
    ): QuestService = QuestService(world.executor, { clock.instant() }, worldClock, calendar, ids, questRows) { shelf.inForce }

    /** Ticks a quest's objective when the world meets it: a structure held, anywhere or on an island. See 0096. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun questObjectives(
        world: EventWorld,
        later: ScheduledLater,
        faults: Faults,
        clock: Clock,
        worldClock: WorldClock,
        islands: Islands,
    ): QuestObjectives =
        QuestObjectives(world.storeFeed, later, faults, world.gate, world.executor, { clock.instant() }, worldClock, islands)

    /** Every quest each house was offered, and what it recorded of each, folded from the same feed. See 0096. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun questRows(world: EventWorld): QuestsProjection = QuestsProjection(world.feed)

    /** The quests' place in the gateway: their part, and the lever that offers one. See decision record 0096. */
    @Bean
    fun questsInTheGateway(quests: QuestService, questRows: QuestsProjection): GatewayMechanic = QuestsMechanic(quests, questRows)
}
