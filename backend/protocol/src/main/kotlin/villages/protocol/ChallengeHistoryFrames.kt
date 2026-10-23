package villages.protocol

import com.fasterxml.jackson.annotation.JsonInclude

// The frames that carry a house's challenges to its player in the game. See Frames.kt for what a frame is, and
// decision record 0107, amended.

/**
 * The player's challenges, every one the house has fought, in the order it fought them, wherever they are looking.
 * Sent after `yourQuests` on hello, always a list, and again whenever one changes: one fought, or the road its quest
 * took heard. See decision record 0107, amended.
 */
data class YourChallenges(val challenges: List<ChallengeRowView>) : ServerFrame

/**
 * One challenge the house fought, as its history says it: its id and title, the quest that raised it, its kind, the
 * house's name and who stood against it, the starting slices brought, what it came to, when it was fought, and the
 * title of the node the quest went on to - absent until heard. `revision` rises with every change to it.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class ChallengeRowView(
    val id: String,
    val revision: Long,
    val title: String,
    val quest: String,
    val kind: String,
    val house: String,
    val against: OpponentView,
    val brought: List<String>,
    val outcome: OutcomeView,
    val foughtAt: String,
    val then: String? = null,
)
