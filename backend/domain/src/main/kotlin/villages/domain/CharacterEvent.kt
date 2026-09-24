package villages.domain

import java.time.Instant

/**
 * An event kept on a character's stream, `character:<uuid>`: what happened to one person. Every one of them
 * is the world's, because a player reaches into the world through their house and never through a
 * character. What a character is to a house - a key figure, today - is written in the house's history, not
 * here. See decision record 0055.
 */
sealed interface CharacterEvent : Event {
    val characterId: CharacterId
}

/**
 * A character came into the world's story: their name, sex and species, the day they were born, which can
 * be long before the day they appeared, their four stats, and their portrait or none. They are on no map
 * until something moves them onto one.
 */
data class CharacterAppeared(
    override val characterId: CharacterId,
    val name: CharacterName,
    val sex: Sex,
    val species: Species,
    val bornOn: WorldTime,
    val stats: Map<Stat, Int>,
    val portrait: String?,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : CharacterEvent, WorldEvent {
    init {
        // A character has all four from the moment they exist, as a house has all five resources. A stored
        // event missing one is malformed and says so here.
        require(stats.keys == Stat.entries.toSet()) { "a character appears with every stat, not ${stats.keys}" }
    }
}

/**
 * A character died. Their history ends here. The houses that held them as a key figure lose them in their
 * own histories, as consequences of this one.
 */
data class CharacterDied(
    override val characterId: CharacterId,
    val cause: String,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : CharacterEvent, WorldEvent

/**
 * One of a character's stats became a new value. The value and not the change, so that a reader of the
 * stream knows where the stat stands without adding anything up. A key figure's power is their stats, so this
 * is what a key figure growing more or less powerful looks like. See decision record 0055.
 */
data class CharacterStatChanged(
    override val characterId: CharacterId,
    val stat: Stat,
    val value: Int,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : CharacterEvent, WorldEvent

/**
 * A character aged out of the ordinary, by some years, or grew younger by them when the number is negative.
 * Ordinary ageing is never an event: an age is counted from the birthday, as a resource is counted from its
 * rate. See decision records 0006 and 0055.
 */
data class CharacterAged(
    override val characterId: CharacterId,
    val years: Int,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : CharacterEvent, WorldEvent

/**
 * A character came to stand somewhere in the world, from nowhere or from where they stood before. It
 * carries where and how much that matters, as everything that puts a thing on the map does; the cell it
 * falls in is worked out downstream. See decision record 0026.
 */
data class CharacterMoved(
    override val characterId: CharacterId,
    val place: Location,
    val significance: Significance,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : CharacterEvent, WorldEvent

/**
 * A character left the map and is nowhere again. A death does not also write this: the dead are on no map
 * from the day they die, and where they stood is where they died.
 */
data class CharacterLeftTheMap(
    override val characterId: CharacterId,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : CharacterEvent, WorldEvent

/** A character was given another portrait, or none: a new likeness, kept from now on. */
data class CharacterPortraitChanged(
    override val characterId: CharacterId,
    val portrait: String?,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : CharacterEvent, WorldEvent
