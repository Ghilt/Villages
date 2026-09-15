package villages.occurrent

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import villages.domain.Effect

/**
 * How a sealed field of an event is written: with a `kind` naming which case it holds.
 *
 * An `Effect` is one of several things, and a reader of the stored JSON has to be able to tell which
 * without guessing from the fields present. That is the one rule decision record 0034 adds to decision
 * 0024's encoding.
 *
 * It is a mix-in rather than annotations on the domain type because the domain depends on the Kotlin
 * standard library and nothing else: how an event is written down is the store's business, and the
 * architecture test would fail the moment a Jackson annotation appeared in `villages.domain`. The names
 * here are part of the stored contract, so they are held to the sealed hierarchy by a test.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = EFFECT_KIND)
@JsonSubTypes(
    JsonSubTypes.Type(value = Effect.FoundAt::class, name = FOUND_AT),
)
internal interface EffectJson

/** The field that names which kind of effect an option carries. */
internal const val EFFECT_KIND = "kind"

internal const val FOUND_AT = "foundAt"
