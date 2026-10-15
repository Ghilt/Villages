package villages.application

import villages.domain.HouseId
import villages.domain.OfferQuest
import villages.domain.PlayerId
import villages.domain.QuestId

/**
 * Offering a house a quest.
 *
 * A thin seam, like every use case here: it works out which house from the player, stamps the two times, and hands
 * the command to the decider, where the rules are. The debug panel's lever today, offering one of the samples; the
 * world will offer through the same door. See decision record 0096.
 */
class QuestService(
    private val executor: HouseCommandExecutor,
    private val clock: Clock,
    private val world: WorldClock,
) {
    /**
     * Offers the player's house the sample of this name, and says which quest it turned out to be. The quest's id is
     * worked out from the command, so the same command sent twice is refused as already offered rather than doubled,
     * and a house that does not exist is refused `noSuchHouse`.
     */
    fun offerSample(player: PlayerId, sample: String, provenance: Provenance): QuestId {
        require(sample in SampleQuests.names) { "there is no sample quest called \"$sample\"" }
        val house = HouseId.of(player)
        val id = QuestId.offered(house, provenance.commandId)
        executor.execute(OfferQuest(house, SampleQuests.named(sample, id), world.today(), clock.now()), provenance)
        return id
    }
}
