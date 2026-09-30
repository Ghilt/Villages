package villages.occurrent

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import villages.domain.Requirement
import villages.domain.RevealImpact
import villages.domain.Then

/**
 * How what follows a line of a dialogue is written: with a `kind`, as an effect is, because it is one of
 * three things and a reader of the stored JSON must not have to guess which. See `EffectJson.kt`.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = KIND)
@JsonSubTypes(
    JsonSubTypes.Type(value = Then.Say::class, name = SAY),
    JsonSubTypes.Type(value = Then.DialogueChoice::class, name = DIALOGUE_CHOICE),
    JsonSubTypes.Type(value = Then.End::class, name = END),
)
internal interface ThenJson

internal const val SAY = "say"
internal const val DIALOGUE_CHOICE = "dialogueChoice"
internal const val END = "end"

/**
 * How a dialogue's requirement is written, the same way. A new kind of requirement is a new name here, and
 * the test holding the names to the sealed hierarchy fails until it has one. See decision record 0067.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = KIND)
@JsonSubTypes(
    JsonSubTypes.Type(value = Requirement.Alive::class, name = ALIVE),
)
internal interface RequirementJson

internal const val ALIVE = "alive"

/**
 * How an option's reveal impact is written, the same way: `shown`, with what it will do, or `hidden`. An option
 * with none is written with a null, as every absent field is. See decision record 0067.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = KIND)
@JsonSubTypes(
    JsonSubTypes.Type(value = RevealImpact.Shown::class, name = SHOWN),
    JsonSubTypes.Type(value = RevealImpact.Hidden::class, name = HIDDEN),
)
internal interface RevealImpactJson

internal const val SHOWN = "shown"
internal const val HIDDEN = "hidden"
