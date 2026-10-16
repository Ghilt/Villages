package villages.gateway

import villages.application.fate.FateCatalogue
import villages.application.fate.FateCatalogue.ActionSpec
import villages.application.fate.FateCatalogue.Deals
import villages.application.fate.FateCatalogue.PoolSpec
import villages.domain.Rarity
import villages.domain.Resource

/**
 * The rig's pools and actions: the first draft's pools, which `world/catalogues/fate.json` began from on 2026-10-16,
 * and a grant of each resource at each rarity in Hearth and the resource's own pool, with gossip in Court. Its own
 * here, beside the rig's catalogue and balance, so a change to the file never moves a test.
 */
internal val RIG_FATE = FateCatalogue(
    pools = listOf(
        PoolSpec("Hearth", emptyList()),
        PoolSpec("Coin", listOf("dialogue.missingWealth", "map.river", "map.coast", "house.weak", "window.river*", "window.lake*", "window.sea*")),
        PoolSpec("Land", listOf("house.holdings:*", "map.ground:*")),
        PoolSpec("Court", listOf("map.house:*", "window.house:*", "figure:*", "dialogue:*")),
        PoolSpec("Learning", listOf("season.winter", "window.character:*")),
        PoolSpec("Faith", listOf("house.pious", "change.piety.rose")),
    ),
    actions = listOf(
        Resource.WEALTH to "Coin",
        Resource.NATURAL_DOMAIN to "Land",
        Resource.INFLUENCE to "Court",
        Resource.REASON to "Learning",
        Resource.PIETY to "Faith",
    ).flatMap { (resource, pool) ->
        Rarity.entries.map { rarity ->
            val id = "${resource.name.lowercase()}.${rarity.name.lowercase()}"
            ActionSpec(id, rarity, listOf("Hearth", pool), "Gain $id", "It comes to the house.", Deals.Grant(resource))
        }
    } + ActionSpec(
        "gossip.common", Rarity.COMMON, listOf("Hearth", "Court"), "Gossip from the kitchens",
        "A servant has heard something about {house}.",
        Deals.Gossip(5, 1500.0, listOf("has been selling off its silver", "keeps a horse it cannot afford")),
    ),
)
