package villages.domain

import java.util.UUID

/** The identity of a house, and the name of its stream: `house:<uuid>`. */
@JvmInline
value class HouseId(val value: UUID) {
    /** The stream this house's events live in. */
    val stream: String get() = "house:$value"

    companion object {
        fun fresh(): HouseId = HouseId(UUID.randomUUID())
    }
}

/** The human, for now an anonymous token the browser generated. */
@JvmInline
value class PlayerId(val value: UUID)
