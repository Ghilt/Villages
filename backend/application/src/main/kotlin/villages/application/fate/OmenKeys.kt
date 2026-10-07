package villages.application.fate

import villages.domain.CharacterId
import villages.domain.DialogueId
import villages.domain.HouseId
import villages.domain.OmenKey
import villages.domain.Resource

/**
 * The names omens go by, in one place, so that a source that reads an omen and a pool that opens on it cannot spell
 * it two ways. A key is stable across rolls and says where the omen came from before its first dot.
 */
object OmenKeys {
    fun holdings(region: String) = OmenKey("house.holdings:$region")
    val WEAK = OmenKey("house.weak")
    val PIOUS = OmenKey("house.pious")

    fun rose(resource: Resource) = OmenKey("change.${resource.name.lowercase()}.rose")

    fun inspectingHouse(house: HouseId) = OmenKey("window.house:${house.value}")
    val INSPECTING_OWN = OmenKey("window.ownHouse")
    fun inspectingCharacter(character: CharacterId) = OmenKey("window.character:${character.value}")

    fun dialogue(dialogue: DialogueId) = OmenKey("dialogue:${dialogue.value}")
    val MISSING_WEALTH = OmenKey("dialogue.missingWealth")

    fun figure(character: CharacterId) = OmenKey("figure:${character.value}")

    val RIVER = OmenKey("map.river")
    val COAST = OmenKey("map.coast")
    val OPEN_SEA = OmenKey("map.openSea")
    val UNKNOWN = OmenKey("map.unknown")
    fun ground(kind: String) = OmenKey("map.ground:$kind")
    fun houseOnTheMap(house: HouseId) = OmenKey("map.house:${house.value}")

    /** A town of 1790 by its real identity, a Wikidata id, which no repainting changes. See 0085. */
    fun town(id: String) = OmenKey("map.town:$id")

    fun season(name: String) = OmenKey("season.$name")
    val WINTER = season("winter")
}
