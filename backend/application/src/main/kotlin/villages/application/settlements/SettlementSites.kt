package villages.application.settlements

import villages.domain.Location
import villages.domain.StructureType

/** What a settlement is: a village, or a fishing village by the water. Not a structure's type, as no structure is one. */
enum class SettlementKind(val word: String) {
    VILLAGE("village"),
    FISHING_VILLAGE("fishingVillage"),
    ;

    companion object {
        /** The kind of the word the bake files it by, or null for one that is not a kind of settlement. */
        fun of(word: String): SettlementKind? = entries.firstOrNull { it.word == word }
    }
}

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
    val type: SettlementKind,
    val level: Int,
    val name: String,
    val place: Location,
    val by: String?,
    val radius: Double = 0.0,
    val buildings: List<SettlementBuilding> = emptyList(),
) {
    init {
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
