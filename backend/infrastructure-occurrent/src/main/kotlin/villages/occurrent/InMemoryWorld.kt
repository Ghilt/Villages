package villages.occurrent

import io.cloudevents.CloudEvent
import org.occurrent.application.converter.CloudEventConverter
import org.occurrent.application.service.blocking.generic.GenericApplicationService
import org.occurrent.eventstore.inmemory.InMemoryEventStore
import org.occurrent.subscription.StartAt
import org.occurrent.subscription.api.blocking.SubscriptionModel
import org.occurrent.subscription.inmemory.InMemorySubscriptionModel
import villages.application.EventFeed
import villages.application.HouseCommandExecutor
import villages.application.StoredEvent
import villages.domain.HouseEvent
import java.util.UUID

/**
 * The event feed port over an Occurrent subscription: every event the store accepts, from now on, as a
 * StoredEvent. Whichever store is underneath, in memory today and MongoDB from increment 0.8, this is the
 * same code, because a subscription model is the same interface over both.
 */
class OccurrentEventFeed(
    private val subscriptions: SubscriptionModel,
    private val converter: CloudEventConverter<HouseEvent>,
) : EventFeed {
    override fun subscribe(subscriber: (StoredEvent) -> Unit): AutoCloseable {
        val id = "feed-${UUID.randomUUID()}"
        val subscription = subscriptions.subscribe(id, null, StartAt.now()) { cloudEvent ->
            subscriber(cloudEvent.toStored(converter))
        }
        subscription.waitUntilStarted()
        return AutoCloseable { subscriptions.cancelSubscription(id) }
    }
}

/** Occurrent's extension attributes, by the names it writes them under. */
private const val STREAM_ID = "streamid"
private const val STREAM_VERSION = "streamversion"

internal fun CloudEvent.toStored(converter: CloudEventConverter<HouseEvent>): StoredEvent = StoredEvent(
    id = id,
    type = type,
    stream = getExtension(STREAM_ID).toString(),
    streamVersion = (getExtension(STREAM_VERSION) as Number).toLong(),
    time = time!!.toInstant(),
    data = String(data!!.toBytes()),
    event = converter.toDomainEvent(this),
)

/**
 * A whole world in memory: store, subscriptions, application service, and the two ports over them.
 * Nothing survives a restart, on purpose, until MongoDB exists. Used by the app when there is no database
 * and by every test that wants the real machinery without one.
 */
class InMemoryWorld : AutoCloseable {
    private val subscriptions = InMemorySubscriptionModel()
    val store = InMemoryEventStore(subscriptions)
    val converter = HouseEvents.converter()
    val service = GenericApplicationService(store, converter)

    val executor: HouseCommandExecutor = OccurrentHouseCommandExecutor(service)
    val feed: EventFeed = OccurrentEventFeed(subscriptions, converter)

    override fun close() {
        subscriptions.shutdown()
    }
}
