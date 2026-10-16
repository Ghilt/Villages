package villages.application.fate

import villages.application.Balance
import villages.application.FreshIds
import villages.domain.Effect

/**
 * The fate catalogue in force as what the engine deals from: its pools, Hearth among them as the one always open, and
 * each action made into the code its kind names - a grant reading the balance as it is dealt, gossip reading the
 * houses near. Made again only when the catalogue changes, which the shelf says by handing over another one. See 0097.
 */
class FateFromCatalogue(
    private val catalogue: () -> FateCatalogue,
    private val houses: HousesNear,
    private val ids: FreshIds,
    private val balance: () -> Balance,
) : () -> FateContent {
    @Volatile
    private var made: Pair<FateCatalogue, FateContent>? = null

    override fun invoke(): FateContent {
        val now = catalogue()
        made?.let { (from, content) -> if (from === now) return content }
        return contentOf(now).also { made = now to it }
    }

    private fun contentOf(fate: FateCatalogue): FateContent {
        val pools = fate.pools.map { spec -> if (spec.name == Pool.HEARTH.name) Pool.HEARTH else Pool(spec.name, spec.opensOn) }
        val byName = pools.associateBy { it.name }
        val actions = fate.actions.map { spec ->
            val inPools = spec.pools.mapNotNull(byName::get).toSet()
            when (val deals = spec.deals) {
                is FateCatalogue.Deals.Grant -> Action(spec.id, spec.rarity, inPools) { _, _ ->
                    Dealt(spec.label, spec.detail, Effect.Grant(deals.resource, balance().roll.grants.getValue(spec.rarity)))
                }
                is FateCatalogue.Deals.Gossip -> Gossip(houses, ids, spec, deals).action(inPools)
            }
        }
        return FateContent(pools, actions)
    }
}
