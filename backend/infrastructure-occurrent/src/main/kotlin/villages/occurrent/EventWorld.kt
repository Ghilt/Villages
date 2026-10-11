package villages.occurrent

import org.occurrent.eventstore.api.SortBy
import org.occurrent.eventstore.api.blocking.EventStoreOperations
import org.occurrent.eventstore.api.blocking.EventStoreQueries
import villages.application.CharacterCommandExecutor
import villages.application.EventFeed
import villages.application.HouseCommandExecutor
import villages.application.Resettable
import villages.application.WipeGate

/**
 * A whole world of events: the store, its subscriptions, and the ports over them, one executor for each kind of
 * stream. Kept in memory, or in MongoDB in a database of the tree's own (decision record 0091); nothing that is
 * handed the ports can tell which.
 */
interface EventWorld : AutoCloseable {
    val executor: HouseCommandExecutor
    val characterExecutor: CharacterCommandExecutor
    val feed: EventFeed

    /** The moment a wipe takes. Every command here is run outside it, and what acts on its own must be too. */
    val gate: WipeGate

    /** Where its events are kept and what that means for a restart, in a few words, for the log and the debug panel. */
    val keptIn: String

    /**
     * Empties the store and everything [folded] from it, and says how many events went.
     *
     * In one moment that nothing written crosses, `gate`: no command is half done when it begins, and none begins
     * until it ends. The streams go first. Then the feed hands every subscriber whatever it still has for it, which
     * the store gave each subscription as it was written and so all of it from before the wipe, and only then is
     * everything folded forgotten. So nothing from the old world is folded into the new one, or sets a reaction off
     * in it, however late it would otherwise have arrived.
     *
     * Stream by stream rather than by one filter because the count is the point: a line saying "emptied
     * the world, 37 events" is a line a reader can believe. See decision record 0036.
     */
    fun wipe(folded: Iterable<Resettable> = emptyList()): Int
}

/** The wipe, over any Occurrent store: every stream it holds deleted, and the count of what they held. */
internal fun <S> S.wipeEveryStream(): Int where S : EventStoreQueries, S : EventStoreOperations {
    val streams = all(SortBy.natural(SortBy.SortDirection.ASCENDING)).use { everything ->
        everything.map { it.getExtension(STREAM_ID).toString() }.toList()
    }
    streams.distinct().forEach(::deleteEventStream)
    return streams.size
}
