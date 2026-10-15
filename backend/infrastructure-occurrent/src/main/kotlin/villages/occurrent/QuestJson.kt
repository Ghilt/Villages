package villages.occurrent

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import villages.domain.DialogueNode
import villages.domain.Objective
import villages.domain.ObjectiveNode
import villages.domain.RewardNode
import villages.domain.Where

/**
 * How a quest's node is written: with a `kind`, as every sealed field of an event is (decision record 0034), because
 * it is one of three things and a reader of the stored JSON must not have to guess which. See decision record 0096.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = KIND)
@JsonSubTypes(
    JsonSubTypes.Type(value = DialogueNode::class, name = DIALOGUE_NODE),
    JsonSubTypes.Type(value = ObjectiveNode::class, name = CHECKLIST),
    JsonSubTypes.Type(value = RewardNode::class, name = REWARD),
)
internal interface QuestNodeJson

internal const val DIALOGUE_NODE = "dialogue"
internal const val CHECKLIST = "checklist"
internal const val REWARD = "reward"

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
