package villages.application

import villages.domain.Banner
import villages.domain.CharacterId
import villages.domain.CharacterName
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Sex
import villages.domain.Species
import villages.domain.Stat
import villages.domain.WorldTime

/** A house that holds a character as a key figure, with what a view of the tie needs to name it. */
data class Holder(val house: HouseId, val name: HouseName, val banner: Banner)

/**
 * A character as the read model holds them: everything the record says about the person, and the houses
 * that hold them, which the record never says. See decision record 0055.
 */
data class CharacterRow(
    val id: CharacterId,
    val name: CharacterName,
    val sex: Sex,
    val species: Species,
    /** The day they were born. An age is the completed months since, over twelve, plus [agedYears]. */
    val bornOn: WorldTime,
    val agedYears: Int,
    val stats: Map<Stat, Int>,
    val portrait: String?,
    val appearedOn: WorldTime,
    val diedOn: WorldTime?,
    /** Every house holding them as a key figure, in the order they were taken in. */
    val keyFigureOf: List<Holder>,
    /** Where they stand on the map today, or null while they are on none - which includes the dead. */
    val place: Location? = null,
    /**
     * The read model's own count, which rises whenever this row changes. Not the character's stream version,
     * because a tie on a house's stream changes the row without touching the character's stream, and a client
     * keeps whichever copy of a row has the higher of these.
     */
    val revision: Long,
)

/** A house's key figures as they now stand, for the player whose house it is. */
data class KeyFiguresChange(val house: HouseId, val player: PlayerId, val keyFigures: List<CharacterRow>)

/**
 * The key figures each house holds. What the key figures pane is drawn from, and what reaches a player
 * wherever they are looking, the way their own house does.
 */
interface KeyFiguresByHouse {
    /** The living characters the house holds, in the order it took them in, which is the pane's order. */
    fun of(house: HouseId): List<CharacterRow>

    /**
     * Every change to a house's key figures, until closed: one taken in or lost, or one of them changed in
     * their own record, told once to each house that holds them.
     */
    fun watch(listener: (KeyFiguresChange) -> Unit): AutoCloseable
}
