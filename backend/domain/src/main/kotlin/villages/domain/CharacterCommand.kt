package villages.domain

import java.time.Instant

/** A request to change a character, named as an imperative. It may be rejected, and it is not stored. */
sealed interface CharacterCommand {
    val characterId: CharacterId
}

/**
 * Bring a character into the world's story: who they are, when they were born and what they are like. What
 * they are to any house is not here, because it is not the character's history but the house's.
 */
data class IntroduceCharacter(
    override val characterId: CharacterId,
    val name: CharacterName,
    val sex: Sex,
    val species: Species,
    val bornOn: WorldTime,
    val stats: Map<Stat, Int>,
    val portrait: String?,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : CharacterCommand

/** Kill a character, for a cause said in a line. Refused unless they have appeared and are alive. */
data class KillCharacter(
    override val characterId: CharacterId,
    val cause: String,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : CharacterCommand

/**
 * Raise or lower one of a character's stats by an amount. The amount rather than the result, so that the
 * decider does the arithmetic against the truth and two quick presses on a stale screen both count.
 */
data class ChangeStat(
    override val characterId: CharacterId,
    val stat: Stat,
    val by: Int,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : CharacterCommand

/** Age a character out of the ordinary, by some years or, with a negative number, back by some. */
data class AgeCharacter(
    override val characterId: CharacterId,
    val years: Int,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : CharacterCommand

/**
 * Put a character somewhere in the world, from nowhere or from where they stood, with how much they matter
 * there. The significance is the character's own and is the caller's to say: it depends on who they are,
 * which nothing decides yet. See decision records 0026 and 0055.
 */
data class MoveCharacter(
    override val characterId: CharacterId,
    val place: Location,
    val significance: Significance,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : CharacterCommand

/** Take a character off the map, so that they are nowhere again. Refused for somebody on no map. */
data class TakeOffTheMap(
    override val characterId: CharacterId,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : CharacterCommand

/** Give a character another portrait, or none. */
data class ChangePortrait(
    override val characterId: CharacterId,
    val portrait: String?,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : CharacterCommand
