package villages.app

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.Dice
import villages.application.FreshIds
import villages.application.fate.FateEngine
import villages.application.fate.GroundMaps
import villages.application.fate.PlaceNamesByMaster
import villages.application.fate.omenSources
import villages.application.fate.FateFromCatalogue
import villages.application.fate.RollService
import villages.application.Shelf
import villages.application.WorldClock
import villages.occurrent.EventWorld
import villages.projections.CharactersProjection
import villages.projections.LastRollsProjection
import villages.projections.DialoguesProjection
import villages.projections.HousesProjection
import villages.projections.SightProjection
import villages.protocol.Calendar
import java.time.Clock

/**
 * Fate: the choice roll, and what each house had at its last one. See decision record 0083.
 * One mechanic's beans in a configuration of its own, so a mechanic is wired where it is: see
 * `docs/plans/mechanic-modules.md`, step 4.
 */
@Configuration
class FateConfig {
    /**
     * The choice roll: the fate engine over the first content and the omen sources there are, and the use case that
     * records what it deals. See decision record 0083.
     */
    @Bean
    @Suppress("LongParameterList")
    fun rolls(
        world: EventWorld,
        houses: HousesProjection,
        characters: CharactersProjection,
        sights: SightProjection,
        dialogueRows: DialoguesProjection,
        lastRolls: LastRollsProjection,
        ground: GroundMaps,
        names: PlaceNamesByMaster,
        clock: Clock,
        worldClock: WorldClock,
        dice: Dice,
        ids: FreshIds,
        shelf: Shelf,
    ): RollService = RollService(
        FateEngine(
            omenSources(
                houses, characters, characters, sights, dialogueRows, lastRolls,
                months = { Calendar.monthOf(it.day) }, grounds = ground, housesNear = houses, names = names,
                balance = { shelf.balance },
            ),
            FateFromCatalogue({ shelf.fate }, houses, ids) { shelf.balance }, dice, ids, { shelf.balance },
        ),
        houses, world.executor, { clock.instant() }, worldClock, ids, { shelf.balance },
    )

    /** What every house had at its last choice roll, which the next one's changes are measured against. See 0083. */
    @Bean(initMethod = "start", destroyMethod = "close")
    fun lastRolls(world: EventWorld): LastRollsProjection = LastRollsProjection(world.feed)
}
