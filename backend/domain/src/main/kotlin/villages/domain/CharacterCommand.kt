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
