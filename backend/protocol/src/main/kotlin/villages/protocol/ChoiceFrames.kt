package villages.protocol

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

// The frames of the choice roll and of every other choice. See Frames.kt for what a frame is, and 0034 and 0083.

/**
 * A choice as the parchment shows it: what is being asked, and the two to four things that could be done
 * about it. The interface renders this and nothing else, so a new kind of choice needs no new frame.
 */
data class ChoiceView(
    val id: String,
    val prompt: String,
    val options: List<OptionView>,
    /** The omens of the roll that dealt it, in the order the report card shows them; left out for any other choice. */
    @get:JsonInclude(JsonInclude.Include.NON_EMPTY)
    val omens: List<OmenView> = emptyList(),
)

/** One option. A rolled one says its `rarity`, by its lower-case name, and the keys of the omens that brought it. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class OptionView(
    val id: String,
    val label: String,
    val detail: String,
    val effect: EffectView,
    val rarity: String? = null,
    @get:JsonInclude(JsonInclude.Include.NON_EMPTY)
    val omens: List<String> = emptyList(),
)

/**
 * One thing the fate engine took into account for a roll: its key, its `kind` by lower-case name - `house`,
 * `change`, `window`, `dialogue`, `keyFigure`, `map` or `season` - the words the player reads, and sometimes a
 * value. See decision record 0083.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class OmenView(val key: String, val kind: String, val words: String, val value: Long? = null)

/** What taking an option would do. `kind` names the case, as it does in the store. See 0034. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes(
    JsonSubTypes.Type(FoundAtView::class, name = "foundAt"),
    JsonSubTypes.Type(GrantView::class, name = "grant"),
    JsonSubTypes.Type(SpendView::class, name = "spend"),
    JsonSubTypes.Type(ConverseView::class, name = "converse"),
    JsonSubTypes.Type(PledgeEffectView::class, name = "pledge"),
)
sealed interface EffectView

data class FoundAtView(val seat: Point, val name: String, val banner: BannerSpec) : EffectView

/** Some of a resource given to the house. `resource` is a wire name, so `naturalDomain` and not Domain. */
data class GrantView(val resource: String, val amount: Long) : EffectView

/** Some of a resource taken from the house: what an option costs. A wire name, as a grant's is. */
data class SpendView(val resource: String, val amount: Long) : EffectView

/**
 * A conversation begun: the dialogue taking the option offers, by its title and nothing more, because what is said
 * in it reaches the page as it is reached and never before. See decision records 0071 and 0083.
 */
data class ConverseView(val title: String) : EffectView

/**
 * Some of a resource tied to an undertaking until a world-day, and given back whole then: what a quest's pledge
 * costs. A wire name, as a grant's is. Not [PledgeView], which is a live pledge in a house's treasury. See decision
 * record 0096.
 */
data class PledgeEffectView(val resource: String, val amount: Long, val until: Long) : EffectView

/**
 * Take action: roll for this player's house. It says what the page is looking at and nothing it could work out for
 * itself - where the view is centred and how close, the houses and characters it has inspect windows open on, the
 * places it opened windows on water at, the dialogue it has open, and the key figure it has focused - and every field
 * is a claim the server checks: a place is read again for the water there, never named by the page. The price, the
 * omens and the hand are all the server's. See decision records 0083, 0084 and 0087.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class RollPayload(
    val centre: Point? = null,
    val zoom: Double? = null,
    @get:JsonInclude(JsonInclude.Include.NON_EMPTY)
    val inspectingHouses: List<String> = emptyList(),
    @get:JsonInclude(JsonInclude.Include.NON_EMPTY)
    val inspectingCharacters: List<String> = emptyList(),
    @get:JsonInclude(JsonInclude.Include.NON_EMPTY)
    val inspectingWaters: List<Point> = emptyList(),
    val dialogue: String? = null,
    val figure: String? = null,
) : CommandPayload

/**
 * Adam's lever: the next roll this player makes is this rarity, by lower-case name, whatever the throw; none puts
 * the throw back. It stands in for the world's luck, so a legendary can be seen without a few hundred rolls.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class NextRarityPayload(val rarity: String? = null) : CommandPayload

/**
 * What a roll drew from, for the debug panel and only while the instruments are open: the pools it opened, which
 * the player never sees, every action that could have been dealt with its weight, the rarity it dealt at, and
 * whether the lever chose that rather than the throw.
 */
data class RollDrawn(
    val opened: List<String>,
    val considered: List<ConsideredView>,
    val rarity: String,
    val forced: Boolean,
) : ServerFrame

/** One action that was in a roll's draw, and how heavily: the number of open pools it is in. */
data class ConsideredView(val action: String, val weight: Int)
