package villages.gateway

import villages.protocol.ErrorFrame
import villages.protocol.EventFrame
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.StandsFrame
import villages.protocol.YourChoice
import villages.protocol.YourDialogues
import villages.protocol.YourHouse
import villages.protocol.YourKeyFigures
import villages.protocol.YourSight
import java.util.concurrent.Executor

/** Events one watcher may have waiting to be sent. Past this they are left out until it has caught up. */
const val MOST_EVENTS_WAITING = 1_000

/**
 * Every frame to one connection leaves through here, one at a time and in the order it was queued, and the queue
 * cannot grow without bound:
 *
 * - map changes are bounded where they gather, before a batch of them is queued: past [MOST_WAITING] the
 *   connection is told to resynchronise, as it always was;
 * - a snapshot of a cell, a tile of stands, or a `your…` frame still waiting is replaced by a newer one of the
 *   same kind, in its place, because a page wants the latest of each and never the one before it;
 * - the events a watcher is sent are capped at [MOST_EVENTS_WAITING] waiting, past which they are left out and
 *   the watcher is told so, once, until it has caught up;
 * - everything else always goes, a command's answer above all.
 *
 * Whoever finds the outbox idle sends what is in it, on [sendOn]: on the thread that queued it, unless the gateway
 * is handed threads of its own to send on. Nothing a send throws gets past it, so a frame for a socket that is
 * going is simply not delivered and the frames after it are still sent. See the scale principles in
 * `ARCHITECTURE.md`.
 */
internal class Outbox(private val transport: Outbound, private val sendOn: Executor) : Outbound {
    private val lock = Any()
    private val waiting = ArrayDeque<ServerFrame>()
    private var sending = false
    private var eventsWaiting = 0
    private var toldOfLeavingOut = false

    override fun send(frame: ServerFrame) {
        synchronized(lock) {
            if (!take(frame) || sending) {
                return
            }
            sending = true
        }
        sendOn.execute(::sendAll)
    }

    /** Queues a frame by the rules above; false when that leaves nothing new to send. */
    private fun take(frame: ServerFrame): Boolean {
        val kind = kindOf(frame)
        if (kind != null) {
            val at = waiting.indexOfFirst { kindOf(it) == kind }
            if (at >= 0) {
                waiting[at] = frame
                return false
            }
        }
        if (frame is EventFrame) {
            if (eventsWaiting >= MOST_EVENTS_WAITING) {
                if (toldOfLeavingOut) {
                    return false
                }
                toldOfLeavingOut = true
                waiting.addLast(ErrorFrame("eventsLeftOut", "this window fell behind the world, and events were left out"))
                return true
            }
            eventsWaiting++
        }
        waiting.addLast(frame)
        return true
    }

    private fun sendAll() {
        while (true) {
            val next = synchronized(lock) {
                val frame = waiting.removeFirstOrNull()
                when {
                    frame == null -> sending = false
                    frame is EventFrame && --eventsWaiting == 0 -> toldOfLeavingOut = false
                }
                frame
            } ?: return
            try {
                transport.send(next)
            } catch (@Suppress("TooGenericExceptionCaught", "SwallowedException") undelivered: Exception) {
                // The close already on its way lets this connection go.
            }
        }
    }

    /** What makes two frames the same one, the later replacing the earlier; null for a frame that always goes. */
    private fun kindOf(frame: ServerFrame): Any? = when (frame) {
        is Snapshot -> SnapshotOf(frame.cell)
        is StandsFrame -> StandsOf(frame.x, frame.y)
        is YourHouse, is YourKeyFigures, is YourSight, is YourDialogues, is YourChoice -> frame::class
        else -> null
    }

    private data class SnapshotOf(val cell: String)

    private data class StandsOf(val x: Int, val y: Int)
}
