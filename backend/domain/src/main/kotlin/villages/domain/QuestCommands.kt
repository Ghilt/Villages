package villages.domain

import java.time.Instant

/**
 * Offer this house a quest, whole. Refused for a house that does not exist, and for a quest it was offered before:
 * the id is worked out from the command that offered it, so the same command sent twice is refused rather than
 * doubled. Its first node is reached from the same decision. See decision record 0096.
 */
data class OfferQuest(
    override val houseId: HouseId,
    val quest: Quest,
    val worldTime: WorldTime,
    val recordedAt: Instant,
) : QuestCommand
