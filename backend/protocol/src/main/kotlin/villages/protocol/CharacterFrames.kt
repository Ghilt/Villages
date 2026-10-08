package villages.protocol

import com.fasterxml.jackson.annotation.JsonInclude

// How characters cross the wire: as a player's key figures, and as people standing on the map. See Frames.kt for
// what a frame is, and decision record 0055.

/** A house holding a character as a key figure, named the way a view of the tie needs it. */
data class HolderView(val id: String, val name: String, val banner: BannerSpec)

/**
 * A character's four stats, each a whole number from one to twenty. On the owner's view of a key figure and
 * nowhere else: what another house's people are like is that house's to know. See decision record 0055.
 */
data class StatsView(val piety: Int, val reason: Int, val kindness: Int, val physical: Int)

/**
 * One of the player's key figures, as the pane shows them.
 *
 * Their age is not on the wire. It is the completed months from `bornOn` to today, over twelve, plus
 * `agedYears`, and the browser has the calendar to work it out and the day to work it out on. `version` is
 * the read model's revision, so that of two copies of one figure the newer wins.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class KeyFigureView(
    val id: String,
    val givenName: String,
    val familyName: String,
    /** `woman` or `man`. */
    val sex: String,
    /** `person`, and nothing else yet. */
    val species: String,
    val bornOn: Long,
    val agedYears: Int,
    val stats: StatsView,
    /** The portrait's key, the file's name in `world/portraits/` without its `.png`; absent for none. */
    val portrait: String? = null,
    /** Every house holding them, in the order they were taken in: the first is whose colours they wear. */
    val keyFigureOf: List<HolderView>,
    /** Where they stand on the map today; absent while they are on none. */
    val place: Point? = null,
    val version: Long,
)

/**
 * A character standing on the map, as everyone holding the cell sees them.
 *
 * Less than a key figure's view on purpose: a stranger sees who somebody is, how old, whose they are and where they
 * stand, and not their stats, which are the house's own. The age is not on the wire, for the reason it is not on a key
 * figure's: it is counted from `bornOn` and `agedYears` on the day it is read. `cell` is the deepest cell the place
 * falls in, as a house's is; `since` is the world-day they came to stand there; `version` is the read model's revision,
 * so of two copies the newer wins; `seenUntil` is as a house's. See 0055.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class CharacterOnMapView(
    val id: String,
    val givenName: String,
    val familyName: String,
    val sex: String,
    val species: String,
    val bornOn: Long,
    val agedYears: Int,
    val portrait: String? = null,
    val place: Point,
    val cell: String,
    /** Every house holding them, in the order they were taken in: the first is whose colours they wear. */
    val keyFigureOf: List<HolderView>,
    val since: Long,
    val version: Long,
    val seenUntil: Long? = null,
)
