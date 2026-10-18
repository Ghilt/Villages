package villages.gateway

import villages.application.EventFeed
import villages.application.RecentEvents
import villages.application.Start
import villages.application.StoredEvent
import villages.application.Unreadable
import villages.application.WorldKept
import villages.application.WorldWipe
import villages.domain.PlayerId
import villages.protocol.ErrorFrame
import villages.protocol.FogOfWar
import villages.protocol.SeeAll
import villages.protocol.WatchEvents
import villages.protocol.WipeWorld
import villages.protocol.WorldWiped
import java.util.concurrent.ConcurrentHashMap

/**
 * How much of the end of the chronicle a watcher is given when it starts watching.
 *
 * A viewer that has just been opened has missed everything, and the world did not begin when it did.
 * What is served is whatever the read model still holds, so asking for more than it keeps is harmless.
 */
const val MOST_RECENT_EVENTS = 100

/** A lever pulled, or a look asked for, on a server whose instruments are closed. */
internal class InstrumentsClosed : RuntimeException("the instruments are closed on this server")

/**
 * Adam's instruments, as one part of the gateway: the four frames that look at the world rather than play in it -
 * watching every event as it is stored, seeing everything whatever its significance, lifting the fog, and emptying the
 * world - and the event page. Each mechanic's levers, which stand in for what the world will one day do, are its own
 * part's, through the shared `lever`, and close with these (see `docs/plans/mechanic-modules.md`, step 6).
 *
 * One setting closes all of them, `villages.instruments`. Open, as it is by default, they are what they always
 * were. Closed, every lever is refused `instrumentsClosed` and each of the four frames is answered with an error
 * of that code, while the player's own commands go on as before. The event page watches without saying hello, so
 * nothing about a player is asked of a look. See decision record 0076.
 */
internal class Instruments(
    val open: Boolean,
    private val core: Core,
    events: EventFeed,
    private val recent: RecentEvents,
    private val emptyTheWorld: WorldWipe,
    private val kept: WorldKept,
) : Part {
    private val watching = ConcurrentHashMap.newKeySet<Gateway.Connection>()

    // From now: the debug panel watches the world happening, and would not thank us for the whole
    // chronicle replayed at it on every connect.
    private val feed: AutoCloseable = events.subscribe(Start.FROM_NOW) { stored -> tellWatchers(stored) }

    /**
     * A window arriving is told what the world holds that this code cannot read, while the instruments are open: what
     * went wrong as the server started was said before any window was there to hear it. See decision record 0036.
     */
    override fun greet(connection: Gateway.Connection, who: PlayerId) {
        val unreadable = kept.unreadable()
        if (open && !unreadable.none) connection.out.send(ErrorFrame("unreadableEvents", told(unreadable)))
    }

    /** The four looks, each a frame, every one refused while the instruments are closed. */
    override fun register(commands: Commands, frames: Frames) {
        frames.on<WatchEvents> { connection, frame -> watchEvents(connection, frame.on) }
        frames.on<SeeAll> { connection, frame -> seeAll(connection, frame.on) }
        frames.on<FogOfWar> { connection, frame -> fogOfWar(connection, frame.on) }
        frames.on<WipeWorld> { connection, _ -> wipe(connection) }
    }

    /**
     * Starts sending a connection every event, beginning with what it missed, or stops.
     *
     * Watching first and replaying after, so that nothing appended in between is lost. The cost is that
     * something can arrive twice, which is the feed's own bargain and the reader's to absorb.
     */
    private fun watchEvents(connection: Gateway.Connection, on: Boolean) = looking(connection, "watchEvents") {
        if (on) {
            watching += connection
            for (stored in recent.latest(MOST_RECENT_EVENTS)) {
                connection.out.send(stored.toFrame())
            }
        } else {
            watching -= connection
        }
    }

    /** The eye: significance set aside for this connection, or taken up again. See decision record 0038. */
    private fun seeAll(connection: Gateway.Connection, on: Boolean) = looking(connection, "seeAll") {
        if (connection.looking.everything != on) {
            connection.lookedAgain(connection.look { it.copy(everything = on) })
        }
    }

    /** The fog of war lifted for this connection, or let fall again. See decision record 0061. */
    private fun fogOfWar(connection: Gateway.Connection, on: Boolean) = looking(connection, "fogOfWar") {
        if (connection.looking.fogged != on) {
            connection.lookedAgain(connection.look { it.copy(fogged = on) })
        }
    }

    /**
     * Empties the world and finishes every session with it. Everybody is told, because a wipe is everybody's: a
     * window left holding a house that no longer exists would be showing a world that is not there. Each one
     * reloads and arrives anew. See decision record 0036.
     */
    private fun wipe(connection: Gateway.Connection) = looking(connection, "wipeWorld") {
        val gone = emptyTheWorld.wipe()
        core.endEverySession(WorldWiped("the world was emptied; $gone event${if (gone == 1) "" else "s"} went"))
    }

    /** A connection that is going hears nothing more. */
    override fun ended(connection: Gateway.Connection) {
        watching -= connection
    }

    private fun looking(connection: Gateway.Connection, frame: String, look: () -> Unit) {
        if (open) {
            look()
        } else {
            connection.out.send(ErrorFrame("instrumentsClosed", "$frame is one of the instruments, and they are closed here"))
        }
    }

    private fun tellWatchers(stored: StoredEvent) {
        val frame = stored.toFrame()
        for (connection in watching) {
            connection.out.send(frame)
        }
    }

    override fun close() {
        feed.close()
    }
}

/** What the debug panel says of a world this code cannot read all of, and what to do about it, pre-alpha. */
internal fun told(unreadable: Unreadable): String = buildString {
    if (unreadable.events > 0) {
        append("${unreadable.events} of this world's ${unreadable.of} events cannot be read by this code, the first ")
        append("${unreadable.first}, and a house with one in its history refuses every command. ")
    }
    if (unreadable.brokenAt != null) {
        append("The store could not be read back ${unreadable.brokenAt}, so the feed may have stopped. ")
    }
    append("Wipe this world: the World section, wipe")
    append(if (unreadable.brokenAt != null) ", then start the game server again." else ".")
}
