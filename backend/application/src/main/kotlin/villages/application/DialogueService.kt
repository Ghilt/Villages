package villages.application

import villages.domain.ActThrough
import villages.domain.CompleteDialogueStep
import villages.domain.DialogueId
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.LineId
import villages.domain.OfferDialogue
import villages.domain.PlayerId

/**
 * Offering a house a dialogue.
 *
 * A thin seam, like every use case here: it works out which house from the player, stamps the two times, and
 * hands the command to the decider, where the rules are. The debug panel's lever today, offering one of the
 * dialogues on the shelf; a storyline, an arrival or a choice's outcome will offer through the same door. See decision
 * records 0071 and 0097.
 */
class DialogueService(
    private val executor: HouseCommandExecutor,
    private val keyFigures: KeyFiguresByHouse,
    private val houses: HousesByPlayer,
    private val clock: Clock,
    private val world: WorldClock,
    /** Every dialogue there is to offer, by its name: the dialogues' catalogue in force. See 0097. */
    private val dialogues: () -> Map<String, DialogueTemplate>,
) {
    /**
     * Offers the player's house the dialogue of this name on the shelf, its roles filled for the house - spoken by its
     * first key figure, where it is spoken by one - and says which dialogue it turned out to be.
     *
     * The key figure is read from the read model, which can be a moment behind, so the house is asked with
     * `ActThrough` before anything is written, as every lever that names a character asks it: refused
     * `NoSuchKeyFigure` for a house that holds nobody, or no longer holds them. The dialogue's id is worked out
     * from the command, so the same command sent twice is refused as already offered rather than doubled. The
     * seat is read from the map's read model, for a line that shows it, and a house it does not hold yet is
     * offered the dialogue with that line showing nothing. A name that is no dialogue on the shelf is refused as a
     * malformed request rather than a refusal of the rules, because no rule was asked.
     */
    fun offer(player: PlayerId, name: String, provenance: Provenance): DialogueId {
        val template = dialogues()[name] ?: throw IllegalArgumentException("there is no dialogue called \"$name\" on the shelf")
        val house = HouseId.of(player)
        val figure = if (template.needsKeyFigure) {
            val first = keyFigures.of(house).firstOrNull() ?: throw HouseError.NoSuchKeyFigure
            executor.execute(ActThrough(house, first.id), provenance)
            DialogueTemplate.Figure(first.id, first.name, first.portrait)
        } else {
            null
        }

        val seat = houses.ofPlayer(player)?.seat
        val dialogue = template.offered(DialogueId.offered(house, provenance.commandId), DialogueTemplate.Filling(house, seat, figure))
        executor.execute(OfferDialogue(house, dialogue, world.today(), clock.now()), provenance)
        return dialogue.id
    }

    /**
     * Takes a step through one of the player's dialogues: an option of a dialogue choice, or the line a stretch
     * read ends on. Whether the line is a step, and the next one, is the house's rule, so anything else is refused
     * there: `NotTheNextStep`, `DialogueOver` for one that has ended, `NoSuchDialogue` for one never offered.
     * Which story the step belongs to is the caller's to say, because it continues the offer's.
     */
    fun step(player: PlayerId, dialogueId: DialogueId, lineId: LineId, provenance: Provenance) {
        executor.execute(
            CompleteDialogueStep(HouseId.of(player), dialogueId, lineId, world.today(), clock.now()),
            provenance,
        )
    }
}
