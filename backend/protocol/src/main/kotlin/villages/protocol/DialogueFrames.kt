package villages.protocol

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

// The frames that carry a dialogue to its player. See Frames.kt for what a frame is, and decision record 0071.

/**
 * The player's dialogues, open and finished, in the order the house was offered them, wherever they are
 * looking. Sent after `yourSight` on hello, always a list, and again whenever one of them changes. What the
 * player has not reached stays on the server: each carries what has been said, the stretch still to read up
 * to and including the next step, and the options pending - never a line past that, and never what a line
 * will give until it has given it. See decision record 0071.
 */
data class YourDialogues(val dialogues: List<DialogueView>) : ServerFrame

/**
 * One dialogue as the player may know it. `revision` rises with every change to it, so a page holds its
 * reading place while it holds. `next` ends in the step to send when there are no `options`, and in the line
 * the dialogue choice follows when there are. Its requirements are never sent: a player learns of one only
 * when it fails, as why the dialogue was lost.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class DialogueView(
    val id: String,
    val revision: Long,
    val title: String,
    /** The picture's key, absent for none. */
    val scene: String? = null,
    val speakers: List<SpeakerView>,
    val said: List<SaidLineView>,
    val next: List<LineView>,
    val options: List<LineView>,
    val ending: EndingView,
)

/** Who speaks: which party, what they are called, their portrait's key and the character they are, if any. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class SpeakerView(
    val id: String,
    val party: Int,
    val name: String,
    val portrait: String? = null,
    val character: String? = null,
)

/**
 * A line still to be read, or an option to pick: who says it and the words, and nothing about what it will do
 * but, on an option, its `revealImpact` - how whoever wrote it chose to show what taking it will do. Absent, the
 * option shows nothing until it is done. And `shows`, what the line shows as it is reached while playing, which
 * a line already said never carries, so a dialogue read back shows nothing. See decision record 0071.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class LineView(
    val id: String,
    val speaker: String,
    val words: String,
    val revealImpact: RevealImpactView? = null,
    val shows: ShowsView? = null,
)

/** What a line shows: a `place`, the camera taken to it, or a `house` or a `character` by id, a window opened. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes(
    JsonSubTypes.Type(ShowsView.Place::class, name = "place"),
    JsonSubTypes.Type(ShowsView.House::class, name = "house"),
    JsonSubTypes.Type(ShowsView.Character::class, name = "character"),
)
sealed interface ShowsView {
    data class Place(val at: Point) : ShowsView

    data class House(val id: String) : ShowsView

    data class Character(val id: String) : ShowsView
}

/** How an option shows what taking it will do: `shown`, with what, or `hidden`, drawn as unknown. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes(
    JsonSubTypes.Type(RevealImpactView.Shown::class, name = "shown"),
    JsonSubTypes.Type(RevealImpactView.Hidden::class, name = "hidden"),
)
sealed interface RevealImpactView {
    data class Shown(val impacts: List<ImpactView>) : RevealImpactView

    data object Hidden : RevealImpactView
}

/** Some of one resource, gained or, below nothing, lost. `resource` is a wire name, so `naturalDomain`. */
data class ImpactView(val resource: String, val amount: Long)

/** A line said, with what saying it did to the house: what it gave, and what it took. */
data class SaidLineView(val id: String, val speaker: String, val words: String, val effects: List<EffectView>)

/** How a dialogue stands. `kind` names the case, as it does for an effect. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes(
    JsonSubTypes.Type(EndingView.Open::class, name = "open"),
    JsonSubTypes.Type(EndingView.Completed::class, name = "completed"),
    JsonSubTypes.Type(EndingView.Lost::class, name = "lost"),
)
sealed interface EndingView {
    data object Open : EndingView

    data object Completed : EndingView

    /** Ended unfinished, because one of its requirements failed; which one is the one the player learns of. */
    data class Lost(val because: RequirementView) : EndingView
}

/** Something a dialogue needs to stay true. `kind` names the case. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes(
    JsonSubTypes.Type(RequirementView.Alive::class, name = "alive"),
)
sealed interface RequirementView {
    /** That this character, by id, is still alive. */
    data class Alive(val character: String) : RequirementView
}
