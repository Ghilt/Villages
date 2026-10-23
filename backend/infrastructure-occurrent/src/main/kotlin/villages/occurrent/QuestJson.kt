package villages.occurrent

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import villages.domain.ChallengeNode
import villages.domain.DialogueNode
import villages.domain.Objective
import villages.domain.ObjectiveNode
import villages.domain.RewardNode
import villages.domain.Where
import villages.domain.challenge.StandIn

/**
 * How a quest's node is written: with a `kind`, as every sealed field of an event is (decision record 0034), because
 * it is one of four things and a reader of the stored JSON must not have to guess which. See decision record 0096.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = KIND)
@JsonSubTypes(
    JsonSubTypes.Type(value = DialogueNode::class, name = DIALOGUE_NODE),
    JsonSubTypes.Type(value = ObjectiveNode::class, name = CHECKLIST),
    JsonSubTypes.Type(value = RewardNode::class, name = REWARD),
    JsonSubTypes.Type(value = ChallengeNode::class, name = CHALLENGE_NODE),
)
internal interface QuestNodeJson

internal const val DIALOGUE_NODE = "dialogue"
internal const val CHECKLIST = "checklist"
internal const val REWARD = "reward"
internal const val CHALLENGE_NODE = "challenge"

/**
 * How an objective is written, the same way. A new kind of objective is a new name here, and the test holding the
 * names to the sealed hierarchy fails until it has one, whichever of the two families it is in.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = KIND)
@JsonSubTypes(
    JsonSubTypes.Type(value = Objective.Deliver::class, name = DELIVER),
    JsonSubTypes.Type(value = Objective.Pledge::class, name = PLEDGE),
    JsonSubTypes.Type(value = Objective.Hold::class, name = HOLD),
)
internal interface ObjectiveJson

internal const val DELIVER = "deliver"
internal const val PLEDGE = "pledge"
internal const val HOLD = "hold"

/** Where a structure an objective asks for must stand, the same way: `anywhere` or `island`. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = KIND)
@JsonSubTypes(
    JsonSubTypes.Type(value = Where.Anywhere::class, name = ANYWHERE),
    JsonSubTypes.Type(value = Where.Island::class, name = ISLAND),
)
internal interface WhereJson

internal const val ANYWHERE = "anywhere"
internal const val ISLAND = "island"

/**
 * What stands in a slot of a challenge's slice, the same way: `keyFigure` or `building`. A quest's challenge node
 * carries its opponent's slices whole. See decision record 0107, amended.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = KIND)
@JsonSubTypes(
    JsonSubTypes.Type(value = StandIn.KeyFigure::class, name = KEY_FIGURE),
    JsonSubTypes.Type(value = StandIn.Building::class, name = BUILDING),
)
internal interface StandInJson

internal const val KEY_FIGURE = "keyFigure"
internal const val BUILDING = "building"

/**
 * How an edge is written: its verdict only when it has one, out of a challenge node, so every edge stored before
 * challenge nodes were reads and writes as it always did.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
internal interface EdgeJson
