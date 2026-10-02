package villages.gateway

import villages.domain.PlayerId
import villages.protocol.ClientFrame
import villages.protocol.Command
import villages.protocol.Hello
import villages.protocol.Ping
import villages.protocol.SubscribeCells
import villages.protocol.UnsubscribeCells
import villages.protocol.ViewTime
import villages.protocol.WorldWiped
import kotlin.reflect.KClass

/**
 * One mechanic's place in the gateway. The connection keeps what every mechanic shares - who the player is and
 * the takeover, the cells held and the fan-out to them, coalescing, the fog gate, and a cell's snapshot - and
 * hands each part what is its own, in the order the gateway lists the parts:
 *
 * - [greet], after the welcome, for what the mechanic tells a player arriving, so that the order of the parts is
 *   the order a page is told things in;
 * - [register], for the commands and the frames it takes;
 * - [ended], for whatever it keeps of a connection whose session is over;
 * - and its own watchers of its own read models, which it closes with [close].
 *
 * A new mechanic is a part of its own and a line in the gateway's list. See decision record 0075.
 */
internal interface Part : AutoCloseable {
    fun greet(connection: Gateway.Connection, who: PlayerId) {}

    fun register(commands: Commands, frames: Frames) {}

    fun ended(connection: Gateway.Connection) {}

    override fun close() {}
}

/** What a part may ask of the gateway's core. */
internal interface Core {
    /** The connection a player plays from, when they are here: one a player. See decision record 0028. */
    fun sessionOf(player: PlayerId): Gateway.Connection?

    /** Every connection holding a cell, or null when nobody does: the whole of the fan-out index. */
    fun holders(cell: String): Set<Gateway.Connection>?

    /** Finishes every session there is with this, which is what a wipe does to them. */
    fun endEverySession(why: WorldWiped)
}

/** The frames the core answers itself. Every other kind of frame is a part's, registered in [Frames]. */
internal val CORE_FRAMES: Set<KClass<out ClientFrame>> = setOf(
    Hello::class, Ping::class, Command::class, SubscribeCells::class, UnsubscribeCells::class, ViewTime::class,
)

/**
 * The frames a page sends that are a part's to answer, each kind with exactly one handler, as [Commands] holds the
 * commands. A second handler for a kind is refused as it is registered, and `GatewayPartsSpec` holds every kind
 * the protocol has to being answered by the core or by one part.
 */
internal class Frames {
    private val handlers = HashMap<KClass<out ClientFrame>, (Gateway.Connection, ClientFrame) -> Unit>()

    fun <F : ClientFrame> on(kind: KClass<F>, handler: (Gateway.Connection, F) -> Unit) {
        require(kind !in handlers && kind !in CORE_FRAMES) { "${kind.simpleName} has a handler already" }
        @Suppress("UNCHECKED_CAST")
        handlers[kind] = handler as (Gateway.Connection, ClientFrame) -> Unit
    }

    /** The kinds a part answers. */
    val kinds: Set<KClass<out ClientFrame>> get() = handlers.keys

    fun handle(connection: Gateway.Connection, frame: ClientFrame) {
        val handler = checkNotNull(handlers[frame::class]) { "no part of the gateway answers ${frame::class.simpleName}" }
        handler(connection, frame)
    }
}

internal inline fun <reified F : ClientFrame> Frames.on(noinline handler: (Gateway.Connection, F) -> Unit) =
    on(F::class, handler)
