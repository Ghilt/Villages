package villages.application

import villages.domain.GiveVision
import villages.domain.HouseId
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.StructureId
import villages.domain.TakeVision
import villages.domain.VisionId

/**
 * Giving a house vision of a place outright, and taking it away again.
 *
 * A thin seam, like every use case here: it stamps the two times, works out which house from the player, and
 * hands the command to the decider, where the rules are. The debug panel's lever today; a storyline that gives
 * a house sight of a far coast will come through the same door. See decision record 0061.
 *
 * Throws a `HouseError` when the decider refuses, exactly as the decider threw it.
 */
class VisionService(
    private val executor: HouseCommandExecutor,
    private val clock: Clock,
    private val world: WorldClock,
    private val ids: FreshIds,
) {
    /**
     * Gives the player's house vision of a place, and says which vision it turned out to be.
     *
     * The id is minted here rather than sent, as a pledge's is: a client naming its own visions could name one
     * twice, and whatever takes it away again needs the name.
     */
    fun give(player: PlayerId, place: Location, provenance: Provenance): VisionId {
        val visionId = VisionId(ids.fresh())
        executor.execute(GiveVision(HouseId.of(player), visionId, place, world.today(), clock.now()), provenance)
        return visionId
    }

    fun take(player: PlayerId, visionId: VisionId, provenance: Provenance) {
        executor.execute(TakeVision(HouseId.of(player), visionId, world.today(), clock.now()), provenance)
    }

    /** Gives [house] the sight of a structure it holds, [radius] kilometres about [place], under the id worked out. */
    fun giveFrom(house: HouseId, structure: StructureId, visionId: VisionId, place: Location, radius: Double, provenance: Provenance) {
        executor.execute(GiveVision(house, visionId, place, world.today(), clock.now(), radius, structure), provenance)
    }

    /** Takes away a vision [house] has: what a structure it no longer holds gave it. */
    fun takeFrom(house: HouseId, visionId: VisionId, provenance: Provenance) {
        executor.execute(TakeVision(house, visionId, world.today(), clock.now()), provenance)
    }
}
