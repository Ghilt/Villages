package villages.occurrent

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import villages.domain.Content

/**
 * How what fills a slot is written: with a `kind` naming whether it is a person or an item, as every sealed field of
 * an event is (decision record 0034). The names are part of the stored contract, held to the sealed hierarchy by a test.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = KIND)
@JsonSubTypes(
    JsonSubTypes.Type(value = Content.Person::class, name = PERSON),
    JsonSubTypes.Type(value = Content.Item::class, name = ITEM),
)
internal interface ContentJson

internal const val PERSON = "person"
internal const val ITEM = "item"
