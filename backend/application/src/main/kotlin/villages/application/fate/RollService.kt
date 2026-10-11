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
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet

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
    /** The rarity each player's next roll is, where the debug panel's lever has said one. */
    private val forced = ConcurrentHashMap<PlayerId, Rarity>()
    private val listeners = CopyOnWriteArraySet<(PlayerId, Rolled, Boolean) -> Unit>()

    /**
     * Rolls, records, and hands back what was rolled. Throws a HouseError when the decider refuses, exactly as the
     * decider threw it; a player with no house is refused before anything rolls. A rarity the lever set stands in
     * for the throw, and is used up only by a roll that is recorded.
     */
    fun roll(player: PlayerId, looking: Looking, provenance: Provenance): Rolled {
        val house = houses.ofPlayer(player) ?: throw HouseError.NoSuchHouse
        val today = world.today()
        val rarity = forced[player]
        val rolled = engine.roll(Moment(house, looking, today, clock.now()), rarity)
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
        forced.remove(player, rarity)
        for (listener in listeners) {
            listener(player, rolled, rarity != null)
        }
        return rolled
    }

    /**
     * The debug panel's lever: this player's next roll is this rarity, whatever the throw, or the throw again when
     * null. It stands in for the world's luck and not for the player.
     */
    fun forceNext(player: PlayerId, rarity: Rarity?) {
        if (rarity == null) forced.remove(player) else forced[player] = rarity
    }

    /** Every roll recorded, with whether the lever chose its rarity, until closed: what the debug panel is told. */
    fun watch(listener: (PlayerId, Rolled, Boolean) -> Unit): AutoCloseable {
        listeners += listener
        return AutoCloseable { listeners -= listener }
    }
}
