package villages.rabbit

import com.rabbitmq.client.Channel
import com.rabbitmq.client.Connection
import io.cloudevents.CloudEvent
import villages.domain.Event

/**
 * The event bridge from the store to the broker (decision record 0094): every stored event published to `villages.events`
 * in the tree's virtual host, under its routing key, as the store holds it, one at a time and in the order written.
 *
 * It rides a carrier that follows the store durably, `MongoWorld.carry`, which keeps its place once [carry]
 * returns, and [carry] returns only once the broker has confirmed the event. When it has not - the broker gone, a
 * confirm refused or late - the event bridge lets its connection go and throws, and the carrier hands it the same event
 * again after a wait that grows to five seconds, saying so once. So the place never passes an event the broker has
 * not got: an event written while the event bridge or the broker was down is published when both are back.
 *
 * Its connection and channel are touched only by the carrier's one thread.
 */
class EventBridge(private val broker: Broker, private val keys: RoutingKeys) : AutoCloseable {
    private var connection: Connection? = null
    private var channel: Channel? = null

    /** Publishes [cloudEvent], read as [event] or null when it cannot be, and returns once the broker has it. */
    fun carry(cloudEvent: CloudEvent, event: Event?) {
        try {
            val publishing = channel?.takeIf { it.isOpen } ?: opened()
            publishing.basicPublish(
                Broker.EXCHANGE,
                keys.of(cloudEvent.type, event),
                Messages.propertiesOf(cloudEvent),
                Messages.bodyOf(cloudEvent),
            )
            publishing.waitForConfirmsOrDie(CONFIRM_MS)
        } catch (@Suppress("TooGenericExceptionCaught") notCarried: Exception) {
            // Whatever went wrong, the next try begins from a connection of its own.
            close()
            throw notCarried
        }
    }

    private fun opened(): Channel {
        close()
        val fresh = broker.connect("villages: the event bridge")
        connection = fresh
        return fresh.createChannel().apply { confirmSelect() }.also { channel = it }
    }

    override fun close() {
        runCatching { connection?.takeIf { it.isOpen }?.close() }
        connection = null
        channel = null
    }

    private companion object {
        /** How long the broker has to confirm an event before it is published again. */
        const val CONFIRM_MS = 5_000L
    }
}
