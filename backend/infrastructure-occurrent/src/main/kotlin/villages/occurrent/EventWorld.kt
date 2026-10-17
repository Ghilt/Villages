package villages.occurrent

import io.cloudevents.CloudEvent
import org.occurrent.application.converter.CloudEventConverter
import org.occurrent.eventstore.api.SortBy
import org.occurrent.eventstore.api.blocking.EventStoreOperations
import org.occurrent.eventstore.api.blocking.EventStoreQueries
import villages.application.CharacterCommandExecutor
import villages.application.EventFeed
import villages.application.HouseCommandExecutor
import villages.application.Resettable
import villages.application.StructureCommandExecutor
import villages.application.Unreadable
import villages.application.WipeGate
import villages.application.WorldCommandExecutor
import villages.application.WorldKept
import villages.domain.Event
import villages.domain.StructureCatalogue

/**
 * A whole world of events: the store, its subscriptions, and the ports over them, one executor for each kind of
 * stream. Kept in memory, or in MongoDB in a database of the tree's own (decision record 0092); nothing that is
 * handed the ports can tell which. Where it is kept, and what of it this code cannot read, is `WorldKept`.
 */
interface EventWorld : WorldKept, AutoCloseable {
    val executor: HouseCommandExecutor
    val characterExecutor: CharacterCommandExecutor

    /** What the read models and the gateway follow: the store's own, or the broker's when it carries the world. */
    val feed: EventFeed

    /**
     * What the world's own reactions follow: always the store's, so the world acts on its own even while the broker
     * is away, and only the view of it falls behind (decision record 0094).
     */
    val storeFeed: EventFeed get() = feed

    /** Structures' streams in this store, decided by the catalogue the server runs on at each decision. 0093, 0097. */
    fun structureExecutor(catalogue: () -> StructureCatalogue): StructureCommandExecutor

    /** The world's own stream in this store, told by the server where two texts of a catalogue differ. 0097. */
    fun worldExecutor(changes: (before: String, after: String) -> List<String>): WorldCommandExecutor

    /** The moment a wipe takes. Every command here is run outside it, and what acts on its own must be too. */
    val gate: WipeGate

    /**
     * Empties the store and everything [folded] from it, and says how many events went.
     *
     * In one moment that nothing written crosses, `gate`: no command is half done when it begins, and none begins
     * until it ends. The streams go first. Then the feed hands every subscriber whatever it still has for it, which
     * the store gave each subscription as it was written and so all of it from before the wipe, and only then is
     * everything folded forgotten. So nothing from the old world is folded into the new one, or sets a reaction off
     * in it, however late it would otherwise have arrived. Afterwards nothing in it is unreadable.
     *
     * The count is the point: a line saying "emptied the world, 37 events" is a line a reader can believe. See
     * decision record 0036.
     */
    fun wipe(folded: Iterable<Resettable> = emptyList()): Int

    /**
     * Every event the store holds, oldest first and as it is stored, its stream and its place in it included: what a
     * save is (decision record 0101). Read in the moment a wipe takes, so no command is half written while it is.
     */
    fun everyEvent(): List<CloudEvent>
}

/** Every event the store holds, oldest first, as it is stored. */
internal fun EventStoreQueries.inOrder(): List<CloudEvent> =
    all(SortBy.natural(SortBy.SortDirection.ASCENDING)).use { everything -> everything.toList() }

/** The wipe, over any Occurrent store: every stream it holds deleted, and the count of what they held. */
internal fun <S> S.wipeEveryStream(): Int where S : EventStoreQueries, S : EventStoreOperations {
    val streams = all(SortBy.natural(SortBy.SortDirection.ASCENDING)).use { everything ->
        everything.map { it.getExtension(STREAM_ID).toString() }.toList()
    }
    streams.distinct().forEach(::deleteEventStream)
    return streams.size
}

/**
 * Reads every event the store holds and tries each as this code would fold it, counting what it cannot read. A
 * store that cannot hand an event back at all stops the reading there, and that is said too. See `Unreadable`.
 */
internal fun EventStoreQueries.readEverything(converter: CloudEventConverter<Event>): Unreadable {
    var of = 0
    var events = 0
    var first: String? = null
    try {
        all(SortBy.natural(SortBy.SortDirection.ASCENDING)).use { everything ->
            everything.forEach { cloudEvent ->
                of++
                try {
                    converter.toDomainEvent(cloudEvent)
                } catch (@Suppress("TooGenericExceptionCaught") unreadable: Exception) {
                    events++
                    first = first ?: "a ${cloudEvent.type} on ${cloudEvent.getExtension(STREAM_ID)} " +
                        "(${unreadable.javaClass.simpleName})"
                }
            }
        }
    } catch (@Suppress("TooGenericExceptionCaught") broken: Exception) {
        val why = "${broken.javaClass.simpleName}: ${broken.message}"
        return Unreadable(events, of, first, brokenAt = "after event $of ($why)")
    }
    return Unreadable(events, of, first)
}
