package villages.gateway

import villages.application.DialogueRow
import villages.application.DialogueService
import villages.application.DialoguesByHouse
import villages.application.Provenance
import villages.domain.DialogueId
import villages.domain.HouseId
import villages.domain.LineId
import villages.domain.PlayerId
import villages.protocol.CompleteDialogueStepPayload
import villages.protocol.YourDialogues
import java.util.UUID

/**
 * A house's dialogues: they reach its player wherever they are looking, like its key figures, because what a
 * house was offered is its own and needs no cell; and a step through one is the player's own command. Each
 * window is sent what it may know of them - what has been said and the stretch ahead, and never a requirement.
 * Offering one is a lever, and the instruments'. See decision records 0071 and 0075.
 */
internal class DialoguesPart(
    private val core: Core,
    private val dialogues: DialogueService,
    private val rows: DialoguesByHouse,
) : Part {
    private val changed: AutoCloseable = rows.watch { change ->
        core.sessionOf(change.player)?.let { tell(it, change.dialogues) }
    }

    override fun greet(connection: Gateway.Connection, who: PlayerId) {
        tell(connection, rows.of(HouseId.of(who)))
    }

    override fun register(commands: Commands, frames: Frames) {
        commands.on<CompleteDialogueStepPayload> { asking, payload ->
            val dialogue = DialogueId(asUuid(payload.dialogueId, "a dialogue id"))
            dialogues.step(
                player = asking.who,
                dialogueId = dialogue,
                lineId = LineId(payload.lineId),
                // A step continues the story the offer began, as an action continues its choice's, so the step
                // and what it pays wear the offer's correlation. The server decides this, not the client.
                provenance = Provenance(asking.commandId, storyOf(asking.who, dialogue) ?: asking.commandId),
            )
        }
    }

    /** The story a dialogue was offered in, so a step through it belongs to that story. */
    private fun storyOf(who: PlayerId, dialogue: DialogueId): UUID? =
        rows.of(HouseId.of(who)).firstOrNull { it.dialogue.id == dialogue }
            ?.let { row -> runCatching { UUID.fromString(row.correlationId) }.getOrNull() }

    private fun tell(connection: Gateway.Connection, dialogues: List<DialogueRow>) {
        connection.out.send(YourDialogues(dialogues.map { it.toView() }))
    }

    override fun close() {
        changed.close()
    }
}
