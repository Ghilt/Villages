package villages.domain

/**
 * What a house is told: the dialogues it was offered and has not finished, each with the steps it has taken
 * through it, and every one it was ever offered. The part of a founded house that decides its dialogue commands
 * and folds its dialogue events. What a line does to the rest of the house it asks of the house, through
 * [Follow], and never does itself. See decision records 0071 and 0075.
 */
data class Dialogues(
    /** The dialogues offered and not finished, in the order they were offered. A finished one leaves the list. */
    val open: List<OpenDialogue> = emptyList(),
    /** Every dialogue ever offered, open or over, so that the same offer twice is refused. */
    val offered: Set<DialogueId> = emptySet(),
) {
    internal fun decide(command: DialogueCommand, player: PlayerId, follow: Follow): List<HouseEvent> = when (command) {
        // Several can be open at once, and the dialogue has checked itself already, so what is left to the house
        // is that it exists and has not been offered this one before. See decision record 0071.
        is OfferDialogue -> {
            if (command.dialogue.id in offered) {
                throw HouseError.DialogueAlreadyOffered
            }
            listOf(PlayerOfferedDialogue(command.houseId, player, command.dialogue, command.worldTime, command.recordedAt))
        }

        // The step, what the line does and the end come out of one decision, as an action and its effect do,
        // so they are appended together and never seen apart. The walk says where a step may be taken, and
        // nothing else is, which is what pays each line once on every path. See decision record 0071.
        is CompleteDialogueStep -> {
            val dialogue = open.firstOrNull { it.dialogue.id == command.dialogueId }
                ?: throw when (command.dialogueId) {
                    in offered -> HouseError.DialogueOver
                    else -> HouseError.NoSuchDialogue
                }
            if (!dialogue.walk().allows(command.lineId)) {
                throw HouseError.NotTheNextStep
            }
            val line = checkNotNull(dialogue.dialogue.line(command.lineId)) { "the walk allowed a line the dialogue lacks" }
            val consequences = follow.follow(line.effects, player, command.worldTime, command.recordedAt)
            val ends = when (line.then) {
                Then.End -> listOf(
                    PlayerCompletedDialogue(command.houseId, player, dialogue.dialogue.id, command.worldTime, command.recordedAt),
                )
                else -> emptyList()
            }
            listOf(
                PlayerCompletedDialogueStep(
                    houseId = command.houseId,
                    player = player,
                    dialogueId = dialogue.dialogue.id,
                    lineId = command.lineId,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            ) + consequences + ends
        }

        // What a failed requirement ends is the house's own rule: every open dialogue that needed it lapses,
        // all in one decision, and a failure that touches none writes nothing. See decision record 0071.
        is FailRequirement -> open.filter { command.requirement in it.dialogue.needs() }.map { lapsing ->
            PlayerLostDialogue(
                houseId = command.houseId,
                player = player,
                dialogueId = lapsing.dialogue.id,
                because = command.requirement,
                worldTime = command.worldTime,
                recordedAt = command.recordedAt,
            )
        }
    }

    internal fun evolve(event: DialogueEvent): Dialogues = when (event) {
        is PlayerOfferedDialogue -> copy(open = open + OpenDialogue(event.dialogue), offered = offered + event.dialogue.id)
        is PlayerCompletedDialogueStep -> copy(
            open = open.map { each ->
                if (each.dialogue.id == event.dialogueId) each.copy(taken = each.taken + event.lineId) else each
            },
        )
        // A dialogue that has ended, finished or lost, is no longer open, and its id stays among those offered,
        // so a step on it is refused as over rather than as unknown.
        is PlayerCompletedDialogue -> copy(open = open.filterNot { it.dialogue.id == event.dialogueId })
        is PlayerLostDialogue -> copy(open = open.filterNot { it.dialogue.id == event.dialogueId })
    }
}
