package villages.application.fate

import villages.application.CatalogueRefused
import villages.application.Catalogues
import villages.domain.Rarity
import villages.domain.Resource

/**
 * The pools and the actions as `world/catalogues/fate.json` says them: what the fate engine deals from. A pool opens
 * on the omens whose keys its patterns name - a key exactly, or every key beginning with what comes before a `*` -
 * except Hearth, which is always open. An action is in pools, of a rarity, and deals one of the kinds the code knows,
 * named by the data and given its words and numbers by it: a grant of a resource, as much as the balance says its
 * rarity grants, or gossip about the nearest house, which reads the world. See decision record 0097.
 */
data class FateCatalogue(val pools: List<PoolSpec>, val actions: List<ActionSpec>) {
    /** A pool by its name, and the omen keys it opens on. */
    data class PoolSpec(val name: String, val opensOn: List<String>)

    /** One action: its id, its rarity, its pools by name, and the words of the option it is dealt into. */
    data class ActionSpec(
        val id: String,
        val rarity: Rarity,
        val pools: List<String>,
        val label: String,
        val detail: String,
        val deals: Deals,
    )

    /** What dealing an action does: the kinds of action there are, each code the data names. */
    sealed interface Deals {
        /** Grants a resource, as much as the balance says an action of its rarity grants. */
        data class Grant(val resource: Resource) : Deals

        /**
         * A servant's word of the nearest other house within [heardOfKm], one of [rumours] by the house it is about,
         * which the house can spread for [spreads] influence. `{house}` in the action's words is that house's name.
         */
        data class Gossip(val spreads: Long, val heardOfKm: Double, val rumours: List<String>) : Deals
    }

    /**
     * The rules the content must keep, held as it is taken on: Hearth is a pool; every action is in pools that exist,
     * and in Hearth, so a hand can always be dealt at every rarity; every rarity has at least [DEALABLE] actions in
     * Hearth that can be dealt with no omens at all - grants, which always can; and no two have one id.
     */
    fun check(): FateCatalogue {
        fun refuse(at: String, must: String): Nothing = throw CatalogueRefused(Catalogues.FATE, "$at $must")
        val named = pools.map { it.name }
        if (Pool.HEARTH.name !in named) refuse("pools", "have Hearth, which is always open")
        if (named.toSet().size != named.size) refuse("pools", "are named once each")
        if (actions.map { it.id }.toSet().size != actions.size) refuse("actions", "have an id each")
        for (action in actions) {
            action.pools.firstOrNull { it !in named }?.let { refuse("actions.${action.id}.pools", "name pools there are, not $it") }
            if (Pool.HEARTH.name !in action.pools) refuse("actions.${action.id}.pools", "have Hearth")
        }
        for (rarity in Rarity.entries) {
            val dealable = actions.count { it.rarity == rarity && it.deals is Deals.Grant }
            if (dealable < DEALABLE) {
                refuse("actions", "have at least $DEALABLE grants that are ${rarity.name.lowercase()}, not $dealable")
            }
        }
        return this
    }

    companion object {
        /** The fewest actions of a rarity that can be dealt with no omens: a hand of three, always. */
        const val DEALABLE = 3
    }
}
