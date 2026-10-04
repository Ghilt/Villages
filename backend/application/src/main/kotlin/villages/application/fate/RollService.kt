package villages.application.fate

import villages.application.Clock
import villages.application.FreshIds
import villages.application.HouseCommandExecutor
import villages.application.HousesByPlayer
import villages.application.Provenance
import villages.application.WorldClock
import villages.domain.Effect
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.PlayerId
import villages.domain.Rarity
import villages.domain.Resource
import villages.domain.Roll
import villages.domain.RollId

/** What a roll costs: ten wealth, Adam's temporary number. The application's, so the domain stays content-free. */
val ROLL_PRICE = Effect.Spend(Resource.WEALTH, 10)

/**
 * The player pressed Take action: the fate engine rolls for their house at this moment, and what it dealt is sent
 * to `decide` as one `Roll`, which records the roll, spends its price and gives its hand, or refuses all three.
 * See decision record 0083.
 */
class RollService(
    private val engine: FateEngine,
    private val houses: HousesByPlayer,
    private val executor: HouseCommandExecutor,
    private val clock: Clock,
    private val world: WorldClock,
    private val ids: FreshIds,
) {
    /**
     * Rolls, records, and hands back what was rolled, for the debug panel's sake. Throws a HouseError when the
     * decider refuses, exactly as the decider threw it; a player with no house is refused before anything rolls.
     * `rarity` stands in for the world's luck, and only the debug panel's lever passes one.
     */
    fun roll(player: PlayerId, looking: Looking, provenance: Provenance, rarity: Rarity? = null): Rolled {
        val house = houses.ofPlayer(player) ?: throw HouseError.NoSuchHouse
        val today = world.today()
        val rolled = engine.roll(Moment(house, looking, today), rarity)
        executor.execute(
            Roll(
                houseId = HouseId.of(player),
                player = player,
                rollId = RollId(ids.fresh()),
                omens = rolled.omens,
                rarity = rolled.rarity,
                price = ROLL_PRICE,
                hand = rolled.hand,
                worldTime = today,
                recordedAt = clock.now(),
            ),
            provenance,
        )
        return rolled
    }
}
