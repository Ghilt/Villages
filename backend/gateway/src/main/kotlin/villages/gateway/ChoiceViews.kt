package villages.gateway

import villages.domain.Choice
import villages.domain.Effect
import villages.domain.Location
import villages.domain.Omen
import villages.domain.OmenKind
import villages.domain.Rarity
import villages.protocol.ChoiceView
import villages.protocol.ConverseView
import villages.protocol.EffectView
import villages.protocol.FoundAtView
import villages.protocol.GrantView
import villages.protocol.OmenView
import villages.protocol.OptionView
import villages.protocol.PledgeEffectView
import villages.protocol.Point
import villages.protocol.SpendView

/**
 * A choice as the parchment shows it, with the omens of the roll that dealt it when a roll did, and where its die
 * landed and how wide its circle was. What the interface renders and the whole of what it knows.
 */
internal fun Choice.toView(
    omens: List<Omen> = emptyList(),
    landing: Location? = null,
    circleKm: Double? = null,
): ChoiceView = ChoiceView(
    id = id.value.toString(),
    prompt = prompt,
    options = options.map { option ->
        OptionView(
            id = option.id.value.toString(),
            label = option.label,
            detail = option.detail,
            effect = option.effect.toView(),
            rarity = option.rarity?.toWire(),
            omens = option.omens.map { it.value },
        )
    },
    omens = omens.map { OmenView(it.key.value, it.kind.toWire(), it.words, it.value) },
    landing = landing?.let { Point(it.lat, it.lon) },
    circleKm = circleKm,
)

/** A rarity's name on the wire, which is its name in lower case. */
internal fun Rarity.toWire(): String = name.lowercase()

/** An omen's kind on the wire, in the wire's camel case. Exhaustive, so a new kind is named before it is sent. */
internal fun OmenKind.toWire(): String = when (this) {
    OmenKind.HOUSE -> "house"
    OmenKind.CHANGE -> "change"
    OmenKind.WINDOW -> "window"
    OmenKind.DIALOGUE -> "dialogue"
    OmenKind.KEY_FIGURE -> "keyFigure"
    OmenKind.MAP -> "map"
    OmenKind.SEASON -> "season"
}

/** A rarity named on the wire, or the refusal. */
internal fun asRarity(name: String): Rarity =
    Rarity.entries.firstOrNull { it.toWire() == name } ?: throw IllegalArgumentException("not a rarity: $name")

internal fun Effect.toView(): EffectView = when (this) {
    is Effect.FoundAt -> FoundAtView(
        seat = Point(seat.lat, seat.lon),
        name = name.value,
        banner = banner.toWire(),
    )

    is Effect.Grant -> GrantView(resource = resource.toWire(), amount = amount)

    is Effect.Spend -> SpendView(resource = resource.toWire(), amount = amount)

    is Effect.Converse -> ConverseView(title = dialogue.title)

    is Effect.Pledge -> PledgeEffectView(resource = resource.toWire(), amount = amount, until = until.day)
}
