package villages.domain

import java.util.UUID

/** The identity of a house, and the name of its stream: `house:<uuid>`. */
@JvmInline
value class HouseId(val value: UUID) {
    /** The stream this house's events live in. */
    val stream: String get() = "house:$value"

    companion object {
        /** What a player's house is named after, so the derivation cannot collide with anything else. */
        private const val NAMED_AFTER = "villages:house:"

        /**
         * The house a player founds. Worked out from the player rather than chosen, so that founding twice
         * writes to the same stream and the second is refused by the decider rather than by a race.
         *
         * This is a rule about *founding*, not a claim that a house belongs to its founder for ever: the
         * identity stays an opaque UUID, and a house that is later transferred, or a second house, needs
         * nothing changed here. See decision record 0028.
         *
         * A name-based UUID, so it is the same on every machine and every run. The digest inside it is a
         * naming function and not a security boundary; a house identity is public, and anyone holding the
         * player's token has already got everything.
         */
        fun of(player: PlayerId): HouseId =
            HouseId(UUID.nameUUIDFromBytes("$NAMED_AFTER${player.value}".toByteArray(Charsets.UTF_8)))
    }
}

/** The identity of one pledge, so that the release can name which one came back. */
@JvmInline
value class PledgeId(val value: UUID)

/** The human, for now an anonymous token the browser generated. */
@JvmInline
value class PlayerId(val value: UUID)
