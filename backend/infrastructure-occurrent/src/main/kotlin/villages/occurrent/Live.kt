package villages.occurrent

import io.cloudevents.CloudEvent
import org.occurrent.subscription.StartAt
import org.occurrent.subscription.api.blocking.SubscriptionModel

/**
 * Where a feed's events come from as they are written: its live half, beside the history, which a feed always reads
 * from the store. The store's own subscriptions are one; the broker is the other (decision record 0094). Whichever
 * it is, every event written after [listen] returns is handed on, markers too, one at a time and in the order they
 * were written - or, when it cannot be, the feed is told it missed some.
 */
fun interface Live {
    /** Starts handing [to] every event written from now on and returns once it listens; closing it stops it. */
    fun listen(subscription: String, to: Listener): AutoCloseable
}

/** What a live half hands on to: its feed. */
interface Listener {
    /** An event written after the live half began to listen, in the order written. */
    fun arrived(event: CloudEvent)

    /**
     * The live half missed what was written for a while, and [listenAgain] makes it listen again: the feed calls it
     * and then reads the history once more, so that what was missed is handed on from the store and nothing twice.
     * Whatever [listenAgain] throws is thrown on, for the live half to try again.
     */
    fun missed(listenAgain: () -> Unit)
}

/** The live half that is the store's own subscriptions: MongoDB's change streams, or the model in memory. */
internal class StoreSubscriptions(private val model: SubscriptionModel) : Live {
    override fun listen(subscription: String, to: Listener): AutoCloseable {
        model.subscribe(subscription, null, StartAt.now()) { to.arrived(it) }.waitUntilStarted()
        return AutoCloseable { model.cancelSubscription(subscription) }
    }
}
