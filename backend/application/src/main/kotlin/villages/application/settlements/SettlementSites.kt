package villages.application.settlements

import villages.domain.Location
import villages.domain.StructureType

/** A building of a settlement as the bake laid it out: its type of the catalogue, its level, and where its foot is. */
data class SettlementBuilding(val type: StructureType, val level: Int, val place: Location)

/**
 * One settlement site, as the bake chose it: an id that outlives a repaint of the master, a type of settlement - a
 * village or a fishing village - its level, its name, where its middle stands, the town of 1790 it stands beside, if
 * any, how far from its middle a structure is part of it, in world units, and its buildings, each a structure of its
 * own. See decision records 0114 and 0117.
 */
data class SettlementSite(
    val id: String,
    val type: StructureType,
    val level: Int,
    val name: String,
    val place: Location,
    val by: String?,
    val radius: Double = 0.0,
    val buildings: List<SettlementBuilding> = emptyList(),
) {
    init {
        require(type.isASettlement) { "a settlement site is a village or a fishing village, not a $type" }
        require(level in 1..3) { "a settlement is a hamlet, a village or a large village, level 1 to 3, not $level" }
    }
}

/**
 * Each master's settlement sites, by the master's name, or null for a master the bake has not chosen them on yet.
 * The shape is a contract, held by `contracts/fixtures/settlements.json`.
 */
fun interface SettlementSites {
    fun of(master: String): List<SettlementSite>?
}
