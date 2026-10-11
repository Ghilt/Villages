package villages.occurrent

import io.cloudevents.CloudEvent
import org.occurrent.eventstore.inmemory.InMemoryEventStore
import org.occurrent.retry.RetryStrategy
import org.occurrent.subscription.StartAt
import org.occurrent.subscription.SubscriptionFilter
import org.occurrent.subscription.api.blocking.Subscription
import org.occurrent.subscription.api.blocking.SubscriptionModel
import org.occurrent.subscription.inmemory.InMemorySubscription
import org.occurrent.subscription.inmemory.InMemorySubscriptionModel
import villages.application.CharacterCommandExecutor
import villages.application.EventFeed
import villages.application.FaultBoard
import villages.application.Faults
import villages.application.HouseCommandExecutor
import villages.application.Fault
import villages.application.Resettable
import villages.application.Unreadable
import villages.application.WipeGate
import java.lang.reflect.Method
import java.time.Duration
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.function.Consumer

/**
 * The world in memory. Nothing survives a restart, on purpose: it is what every test wants that needs the real
 * machinery without a database, and what the app runs on when it is not told to keep its world in MongoDB.
 * Whatever acts on it and throws is said on `faults`, which the server's log and the gateway watch.
 */
class InMemoryWorld(val faults: Faults = FaultBoard()) : EventWorld {
    /**
     * The threads the subscriptions run on. A stopped subscription notices only when its half-second poll comes
     * back, and the model's shutdown waits for that, so shutting this down wakes them rather than waiting.
     */
    internal val dispatcher: ExecutorService = object : ExecutorService by Executors.newCachedThreadPool() {
        override fun shutdown() {
            shutdownNow()
        }
    }

    // Occurrent's own defaults, but for the dispatcher.
    private val subscriptions = InMemorySubscriptionModel(dispatcher, RetryStrategy.fixed(200))
    val store = InMemoryEventStore(subscriptions)
    val converter = Events.converter()

    override val gate = WipeGate()

    override val executor: HouseCommandExecutor = OccurrentHouseCommandExecutor(store, converter, gate)
    override val characterExecutor: CharacterCommandExecutor = OccurrentCharacterCommandExecutor(store, converter, gate)
    override val feed: EventFeed = OccurrentEventFeed(StopOnCancel(subscriptions), store, converter, faults, gate)

    override val keptIn = "in memory, and gone when the server stops"

    override fun wipe(folded: Iterable<Resettable>): Int = gate.wiping {
        store.wipeEveryStream().also {
            handedOn()
            folded.forEach(Resettable::reset)
            reading = Unreadable.NONE
        }
    }

    /** The last reading of the whole store: made the first time it is asked, and nothing unreadable after a wipe. */
    @Volatile
    private var reading: Unreadable? = null

    override fun unreadable(): Unreadable = reading ?: store.readEverything(converter).also { reading = it }

    /**
     * Waits until every subscription has handed on what it was given. One that never does is stuck whatever the
     * wipe does, so it is said, and the wipe goes on without it rather than leaving the world half emptied.
     */
    private fun handedOn() {
        try {
            subscriptions.waitUntilAllEventsProcessed(HANDING_ON)
        } catch (stuck: IllegalStateException) {
            faults.report(Fault("the wipe", "waiting for the feed to hand on what was written before it", stuck))
        }
    }

    override fun close() {
        subscriptions.shutdown()
    }

    private companion object {
        /** Far longer than any fold takes: a subscription still busy after this is stuck. */
        val HANDING_ON: Duration = Duration.ofSeconds(10)
    }
}

/**
 * Occurrent 0.33.0's in-memory model cancels a subscription by forgetting it, and leaves its thread polling for
 * as long as the process runs; shutting the model down then waits five seconds for that thread and gives up.
 * Occurrent's master stops the subscription on cancel, and no release has it yet. Until one does, this does
 * what that fix does, through the package-private method the model's own shutdown calls.
 */
private class StopOnCancel(private val model: InMemorySubscriptionModel) : SubscriptionModel by model {
    private val subscribed = ConcurrentHashMap<String, Subscription>()

    override fun subscribe(
        subscriptionId: String,
        filter: SubscriptionFilter?,
        startAt: StartAt,
        action: Consumer<CloudEvent>,
    ): Subscription = model.subscribe(subscriptionId, filter, startAt, action).also { subscribed[subscriptionId] = it }

    override fun cancelSubscription(subscriptionId: String) {
        model.cancelSubscription(subscriptionId)
        subscribed.remove(subscriptionId)?.let { stop.invoke(it) }
    }

    private companion object {
        val stop: Method = InMemorySubscription::class.java.getDeclaredMethod("shutdown").apply { isAccessible = true }
    }
}
