package villages.application

import villages.domain.ActThrough
import villages.domain.DialogueId
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.OfferDialogue
import villages.domain.PlayerId

/**
 * Offering a house a dialogue.
 *
 * A thin seam, like every use case here: it works out which house from the player, stamps the two times, and
 * hands the command to the decider, where the rules are. The debug panel's lever today, offering one of the
 * samples; a storyline, an arrival or a choice's outcome will offer through the same door. See decision record
 * 0067.
 */
class DialogueService(
    private val executor: HouseCommandExecutor,
    private val keyFigures: KeyFiguresByHouse,
    private val clock: Clock,
    private val world: WorldClock,
) {
    /**
     * Offers the player's house the sample of this name, spoken by its first key figure, and says which dialogue
     * it turned out to be.
     *
     * The key figure is read from the read model, which can be a moment behind, so the house is asked with
     * `ActThrough` before anything is written, as every lever that names a character asks it: refused
     * `NoSuchKeyFigure` for a house that holds nobody, or no longer holds them. The dialogue's id is worked out
     * from the command, so the same command sent twice is refused as already offered rather than doubled.
     */
    fun offerSample(player: PlayerId, sample: String, provenance: Provenance): DialogueId {
        require(sample in SampleDialogues.names) { "there is no sample dialogue called \"$sample\"" }
        val house = HouseId.of(player)
        val figure = keyFigures.of(house).firstOrNull() ?: throw HouseError.NoSuchKeyFigure
        executor.execute(ActThrough(house, figure.id), provenance)

        val dialogue = SampleDialogues.named(sample, DialogueId.offered(house, provenance.commandId), figure)
        executor.execute(OfferDialogue(house, dialogue, world.today(), clock.now()), provenance)
        return dialogue.id
    }
}
