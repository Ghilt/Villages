package villages.gateway

import villages.application.Provenance
import villages.application.WriteConflict
import villages.domain.DomainError
import villages.domain.PlayerId
import villages.protocol.Command
import villages.protocol.CommandAccepted
import villages.protocol.CommandPayload
import villages.protocol.CommandRejected
import java.util.UUID
import kotlin.reflect.KClass

/** Who asked for a command and under which id: what every handler is handed beside its payload. */
internal class Asking(val who: PlayerId, val commandId: UUID) {
    /** The provenance of a command that begins a story of its own, which most do. See decision record 0035. */
    val startingAStory: Provenance get() = Provenance.startedBy(commandId)
}

/**
 * Every command the gateway takes: each kind of payload with exactly one handler, put there by the part of the
 * gateway that owns it, so that a new command is a handler in its mechanic's part rather than a branch in the
 * connection. A second handler for a kind is refused as it is registered, and `CommandsSpec` holds every kind
 * the protocol has to having one.
 *
 * A handler throws what the application throws - a domain refusal, a write conflict, an argument that is not
 * one - and the connection answers it. See decision record 0076.
 */
internal class Commands {
    private val handlers = HashMap<KClass<out CommandPayload>, (Asking, CommandPayload) -> Unit>()

    fun <P : CommandPayload> on(kind: KClass<P>, handler: (Asking, P) -> Unit) {
        require(kind !in handlers) { "${kind.simpleName} has a handler already" }
        @Suppress("UNCHECKED_CAST")
        handlers[kind] = handler as (Asking, CommandPayload) -> Unit
    }

    /** The kinds that have a handler. */
    val kinds: Set<KClass<out CommandPayload>> get() = handlers.keys

    fun handle(asking: Asking, payload: CommandPayload) {
        val handler = checkNotNull(handlers[payload::class]) { "no part of the gateway takes ${payload::class.simpleName}" }
        handler(asking, payload)
    }
}

internal inline fun <reified P : CommandPayload> Commands.on(noinline handler: (Asking, P) -> Unit) = on(P::class, handler)

/**
 * Answers a command a connection sent: refused unless it has said who it is and the id is an identity, then handed
 * to its one handler, and whatever that throws turned into the refusal the protocol carries.
 */
internal fun Commands.answer(frame: Command, who: PlayerId?, out: Outbound) {
    if (who == null) {
        out.send(CommandRejected(frame.commandId, "notIntroduced"))
        return
    }
    // The id becomes the causation of every event this command writes, so it has to be an
    // identity rather than whatever the client felt like sending. See decision record 0035.
    val commandId = runCatching { UUID.fromString(frame.commandId) }.getOrNull()
    if (commandId == null) {
        out.send(CommandRejected(frame.commandId, "malformed: a command id is a UUID"))
        return
    }

    try {
        handle(Asking(who, commandId), frame.command)
        out.send(CommandAccepted(frame.commandId))
    } catch (@Suppress("SwallowedException") closed: InstrumentsClosed) {
        out.send(CommandRejected(frame.commandId, "instrumentsClosed"))
    } catch (refused: DomainError) {
        out.send(CommandRejected(frame.commandId, refused.reasonCode()))
    } catch (@Suppress("SwallowedException") busy: WriteConflict) {
        // Not a refusal: the stream moved under us. Trying again may well be accepted.
        out.send(CommandRejected(frame.commandId, "conflict"))
    } catch (malformed: IllegalArgumentException) {
        out.send(CommandRejected(frame.commandId, "malformed: ${malformed.message}"))
    }
}
