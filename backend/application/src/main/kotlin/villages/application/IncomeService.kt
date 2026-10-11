package villages.application

import villages.domain.HouseId
import villages.domain.IncomeSource
import villages.domain.Resource
import villages.domain.SetIncome

/**
 * Setting what one source pays a house. A thin seam, like every use case here: it stamps the two times and hands
 * the command to the decider, where the rules are. The standing-effects listener today, for what a structure pays
 * its holder. See docs/plans/structures.md.
 */
class IncomeService(
    private val executor: HouseCommandExecutor,
    private val clock: Clock,
    private val world: WorldClock,
) {
    /** From now [house] is paid [ratesPerSecond] from [source]; the rates it is paid already write nothing. */
    fun pay(house: HouseId, source: IncomeSource, ratesPerSecond: Map<Resource, Double>, provenance: Provenance) {
        executor.execute(SetIncome(house, source, ratesPerSecond, world.today(), clock.now()), provenance)
    }
}
