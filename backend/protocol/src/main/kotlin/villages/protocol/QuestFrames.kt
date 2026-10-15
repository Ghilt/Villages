package villages.protocol

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

// The frames that carry a quest to its player. See Frames.kt for what a frame is, and decision record 0096.

/**
 * The player's quests, open and finished, in the order the house was offered them, wherever they are looking. Sent
 * after `yourDialogues` on hello, always a list, and again whenever one of them changes. What is not drawn stays on
 * the server: each carries only the nodes its walk draws, a question mark as no more than its place, and an edge to
 * a node not drawn as a stub. See decision record 0096.
 */
data class YourQuests(val quests: List<QuestView>) : ServerFrame

/** One quest as the player may know it. `revision` rises with every change to it. Its `ending` is a dialogue's. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class QuestView(
    val id: String,
    val revision: Long,
    val title: String,
    /** The picture's key, absent for none. */
    val scene: String? = null,
    val nodes: List<QuestNodeView>,
    val edges: List<QuestEdgeView>,
    val ending: EndingView,
)

/**
 * One node drawn on the quest's map: its id, how far down it stands, and what it is to the quest now - `done`,
 * `current`, `ahead` or `lost`. A question mark carries nothing more; a node shown for what it is carries its kind -
 * `dialogue`, `checklist` or `reward` - and title, a dialogue node the dialogue it offers, a checklist its objectives
 * and a reward what it gives.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class QuestNodeView(
    val id: String,
    val row: Int,
    val state: String,
    val kind: String? = null,
    val title: String? = null,
    val dialogueId: String? = null,
    val objectives: List<ObjectiveView>? = null,
    val gives: List<EffectView>? = null,
)

/**
 * An edge drawn on the map: `walked`, `ahead` or `lost`. Either end is absent where that node is not drawn, which is
 * a stub: the player sees that something is there, and not what.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class QuestEdgeView(val from: String? = null, val to: String? = null, val state: String)

/**
 * One objective of a checklist, and whether it is ticked. `kind` names the case: a `deliver` or a `pledge` the
 * player presses for, and a `hold` the world ticks. A resource is a wire name, so `naturalDomain` and not Domain.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes(
    JsonSubTypes.Type(ObjectiveView.Deliver::class, name = "deliver"),
    JsonSubTypes.Type(ObjectiveView.Pledge::class, name = "pledge"),
    JsonSubTypes.Type(ObjectiveView.Hold::class, name = "hold"),
)
sealed interface ObjectiveView {
    val id: String
    val met: Boolean

    data class Deliver(override val id: String, override val met: Boolean, val resource: String, val amount: Long) : ObjectiveView

    data class Pledge(
        override val id: String,
        override val met: Boolean,
        val resource: String,
        val amount: Long,
        val months: Int,
    ) : ObjectiveView

    /** A structure of a type held, `anywhere` or on an `island`. */
    data class Hold(override val id: String, override val met: Boolean, val structureType: String, val where: String) : ObjectiveView
}
