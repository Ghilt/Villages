package villages.gateway

import villages.domain.WorldTime
import villages.protocol.ErrorFrame
import villages.protocol.ViewTime

/**
 * The timeline: a connection's eye moved along the world's days. Every held cell is answered again as of that day,
 * so the map redraws the world as it was, and from then on only changes that exist on that day are sent. See
 * decision record 0075.
 */
internal class TimelinePart : Part {
    override fun register(commands: Commands, frames: Frames) {
        frames.on<ViewTime> { connection, frame -> view(connection, frame.at) }
    }

    private fun view(connection: Gateway.Connection, at: Long?) {
        if (at != null && at < 0) {
            connection.out.send(ErrorFrame("badTime", "the world's calendar starts at day 0, not $at"))
            return
        }
        connection.lookedAgain(connection.look { it.copy(at = at?.let { day -> WorldTime(day) }) })
    }
}
