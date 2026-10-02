package villages.gateway

import villages.application.ChoicesByPlayer
import villages.application.DialogueService
import villages.application.DialoguesByHouse
import villages.application.Provenance
import villages.application.TakeActionService
import villages.domain.ChoiceId
import villages.domain.DialogueId
import villages.domain.HouseId
import villages.domain.LineId
import villages.domain.OptionId
import villages.domain.PlayerId
import villages.protocol.CompleteDialogueStepPayload
import villages.protocol.TakeActionPayload
import java.util.UUID

/**
 * The player's own commands, which no setting closes: taking an option of the choice they were given, and taking
 * a step through a dialogue. Each continues the story its question began, so what is answered and what the answer
 * does wear the question's correlation. The server decides that, never the client: nothing about correlation
 * crosses the wire. See decision records 0035 and 0071.
 */
internal fun Commands.play(
    takeAction: TakeActionService,
    dialogues: DialogueService,
    choices: ChoicesByPlayer,
    dialogueRows: DialoguesByHouse,
) {
    /** The story the pending choice began, so an action answering it belongs to that story. */
    fun pendingStory(who: PlayerId): UUID? =
        choices.pendingOf(who)?.let { row -> runCatching { UUID.fromString(row.correlationId) }.getOrNull() }

    /** The story a dialogue was offered in, so a step through it belongs to that story. */
    fun dialogueStory(who: PlayerId, dialogue: DialogueId): UUID? =
        dialogueRows.of(HouseId.of(who)).firstOrNull { it.dialogue.id == dialogue }
            ?.let { row -> runCatching { UUID.fromString(row.correlationId) }.getOrNull() }

    on<TakeActionPayload> { asking, payload ->
        takeAction.take(
            player = asking.who,
            choiceId = ChoiceId(asUuid(payload.choiceId, "a choice id")),
            optionId = OptionId(asUuid(payload.optionId, "an option id")),
            provenance = Provenance(asking.commandId, pendingStory(asking.who) ?: asking.commandId),
        )
    }

    on<CompleteDialogueStepPayload> { asking, payload ->
        val dialogue = DialogueId(asUuid(payload.dialogueId, "a dialogue id"))
        dialogues.step(
            player = asking.who,
            dialogueId = dialogue,
            lineId = LineId(payload.lineId),
            provenance = Provenance(asking.commandId, dialogueStory(asking.who, dialogue) ?: asking.commandId),
        )
    }
}
