package villages.occurrent

import io.cloudevents.CloudEvent
import org.occurrent.subscription.StartAt
import org.occurrent.subscription.api.blocking.SubscriptionModel

/**
 * Where a feed's events come from as they are written: its live half, beside the history, which a feed always reads
 * from the store. The store's own subscriptions are one; the broker is the other (decision record 0094). Whichever
 * it is, every event written after [listen] returns is handed on, markers too, one at a time and in the order they
 * were written.
 */
fun interface Live {
    /** Starts handing [arrived] every event written from now on and returns once it listens; closing it stops it. */
    fun listen(subscription: String, arrived: (CloudEvent) -> Unit): AutoCloseable
}

/** The live half that is the store's own subscriptions: MongoDB's change streams, or the model in memory. */
internal class StoreSubscriptions(private val model: SubscriptionModel) : Live {
    override fun listen(subscription: String, arrived: (CloudEvent) -> Unit): AutoCloseable {
        model.subscribe(subscription, null, StartAt.now()) { arrived(it) }.waitUntilStarted()
        return AutoCloseable { model.cancelSubscription(subscription) }
    }
}
