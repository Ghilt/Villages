package villages.gateway

import villages.domain.Choice
import villages.domain.Effect
import villages.protocol.ChoiceView
import villages.protocol.EffectView
import villages.protocol.FoundAtView
import villages.protocol.GrantView
import villages.protocol.OptionView
import villages.protocol.Point
import villages.protocol.SpendView

/** A choice as the parchment shows it. What the interface renders and the whole of what it knows. */
internal fun Choice.toView(): ChoiceView = ChoiceView(
    id = id.value.toString(),
    prompt = prompt,
    options = options.map { option ->
        OptionView(
            id = option.id.value.toString(),
            label = option.label,
            detail = option.detail,
            effect = option.effect.toView(),
        )
    },
)

internal fun Effect.toView(): EffectView = when (this) {
    is Effect.FoundAt -> FoundAtView(
        seat = Point(seat.lat, seat.lon),
        name = name.value,
        banner = banner.toWire(),
    )

    is Effect.Grant -> GrantView(resource = resource.toWire(), amount = amount)

    is Effect.Spend -> SpendView(resource = resource.toWire(), amount = amount)
}
