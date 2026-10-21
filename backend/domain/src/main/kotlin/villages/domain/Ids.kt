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

/** The identity of a character, and the name of their stream: `character:<uuid>`. */
@JvmInline
value class CharacterId(val value: UUID) {
    /** The stream this character's events live in. */
    val stream: String get() = "character:$value"

    companion object {
        /** What a character is named after, so the derivation cannot collide with anything else. */
        private const val NAMED_AFTER = "villages:character:"

        /**
         * The character a command brings into a house. Worked out rather than minted, as a house's identity
         * is, so that the same command sent twice writes to one stream and the decider refuses the second
         * appearance rather than letting a twin appear.
         *
         * The house is in the name as well as the command, because a command's id is public - it is the
         * causation of every event it wrote - and one copied off somebody else's event must not reach into
         * their house. See decision record 0055.
         */
        fun broughtIn(house: HouseId, commandId: UUID): CharacterId =
            CharacterId(UUID.nameUUIDFromBytes("$NAMED_AFTER${house.value}:$commandId".toByteArray(Charsets.UTF_8)))
    }
}

/** The identity of a structure, and the name of its stream: `structure:<uuid>`. See decision record 0093. */
@JvmInline
value class StructureId(val value: UUID) {
    /** The stream this structure's events live in. */
    val stream: String get() = "structure:$value"

    companion object {
        /** What a structure is named after, so the derivation cannot collide with anything else. */
        private const val NAMED_AFTER = "villages:structure:"

        /**
         * The structure a lever raises. Worked out from the player who pulled it and the command, as a character's
         * is from its house, so the same command sent twice writes to one stream and the second raising is refused,
         * and a command id copied off somebody else's event raises nothing of theirs.
         */
        fun raisedBy(player: PlayerId, commandId: UUID): StructureId =
            StructureId(UUID.nameUUIDFromBytes("$NAMED_AFTER${player.value}:$commandId".toByteArray(Charsets.UTF_8)))

        /**
         * One of the structures standing in Antarctica for Adam, one of each type: the same on every start, so a
         * server that starts again over a kept world raises none of them twice. See docs/plans/structures.md.
         */
        fun inAntarctica(type: StructureType): StructureId =
            StructureId(UUID.nameUUIDFromBytes("${NAMED_AFTER}antarctica:${type.name}".toByteArray(Charsets.UTF_8)))

        /**
         * The castle founding raises for [house], its first seat: worked out from the house, so a founding heard again
         * raises it on the same stream, and is refused there.
         */
        fun seatOf(house: HouseId): StructureId =
            StructureId(UUID.nameUUIDFromBytes("${NAMED_AFTER}seat:${house.value}".toByteArray(Charsets.UTF_8)))

        /**
         * A building the opening raises of a settlement the bake laid out, by its site's id and its number among the
         * site's buildings: worked out from them, so an opening after a restart raises none twice, and a site that keeps
         * its id through a repaint keeps its buildings. See decision records 0114 and 0117.
         */
        fun ofSettlementBuilding(site: String, number: Int): StructureId =
            StructureId(UUID.nameUUIDFromBytes("${NAMED_AFTER}settlement:$site:$number".toByteArray(Charsets.UTF_8)))
    }
}

/** The identity of one pledge, so that the release can name which one came back. */
@JvmInline
value class PledgeId(val value: UUID)

/** The identity of one vision given outright, so that taking it away can name which. See decision 0061. */
@JvmInline
value class VisionId(val value: UUID) {
    companion object {
        /**
         * The vision [house] has from [structure] for the holding that began at the structure's [since]th event:
         * worked out rather than minted, so the same holding given twice is refused rather than seen twice.
         */
        fun seenFrom(structure: StructureId, house: HouseId, since: Long): VisionId =
            VisionId(UUID.nameUUIDFromBytes("villages:vision:${structure.value}:${house.value}:$since".toByteArray(Charsets.UTF_8)))
    }
}

/**
 * Whoever issues a house's commands: a person, for now an anonymous token the browser generated, or a house bot the
 * world plays (0108).
 */
@JvmInline
value class PlayerId(val value: UUID) {
    companion object {
        /**
         * The player of the house bot standing outside the ruin of [town], a town of 1790 by its id: name-based, so
         * the same bot is the same player on every tree and at every opening, and is made only once.
         */
        fun botAt(town: String): PlayerId = PlayerId(UUID.nameUUIDFromBytes("villages:bot:$town".toByteArray(Charsets.UTF_8)))
    }
}
