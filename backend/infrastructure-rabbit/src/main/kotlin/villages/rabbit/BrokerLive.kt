package villages.rabbit

import com.rabbitmq.client.AMQP
import com.rabbitmq.client.CancelCallback
import com.rabbitmq.client.Connection
import com.rabbitmq.client.DeliverCallback
import villages.application.Fault
import villages.application.Faults
import villages.occurrent.Listener
import villages.occurrent.Live
import java.util.UUID
import kotlin.concurrent.thread

/**
 * A feed's live half taken from the broker (decision record 0094): each follower listens through a queue of its own,
 * exclusive, bound to everything on `villages.events`, over a connection of its own named after it, so that the
 * management page says who is behind. What it is handed is the stored event as the bridge published it.
 *
 * A queue lives as long as its connection, and what is published while it is gone is lost to it. So when the
 * connection goes, or the queue is deleted from under it, the follower says so once, and makes a connection and a
 * queue again until it can, each time through its feed's `missed`, which listens again and then reads the history
 * once more: what was missed comes from the store, and nothing twice. The client's own recovery is off, because it
 * would bind the queue again outside the wipe gate, where a wipe could fall between the binding and the history.
 */
class BrokerLive(private val broker: Broker, private val faults: Faults) : Live {
    override fun listen(subscription: String, to: Listener): AutoCloseable =
        Following(subscription, to).apply { open(subscription) }

    private inner class Following(private val subscription: String, private val to: Listener) : AutoCloseable {
        /** Who follows, as the management page and the panel say it: the follower's name, without its suffix. */
        private val follower = subscription.substringBefore('.')

        @Volatile
        private var closed = false

        @Volatile
        private var connection: Connection? = null

        /** Makes a connection and [queue], and listens on it: once it returns, everything published is handed on. */
        fun open(queue: String) {
            val opened = broker.connect("villages: $follower")
            opened.addShutdownListener { why -> if (!closed && !why.isInitiatedByApplication) lost(why) }
            try {
                val channel = opened.createChannel()
                channel.queueDeclare(queue, false, true, true, null)
                channel.queueBind(queue, Broker.EXCHANGE, "#")
                val deliver = DeliverCallback { _, delivery -> hand(delivery.properties, delivery.body) }
                // The broker cancels a consumer whose queue was deleted, and that is as good as the connection gone.
                val cancelled = CancelCallback { if (!closed) lost(IllegalStateException("its queue $queue was deleted")) }
                channel.basicConsume(queue, true, deliver, cancelled)
            } catch (@Suppress("TooGenericExceptionCaught") failed: Exception) {
                runCatching { opened.close() }
                throw failed
            }
            connection = opened
        }

        private fun hand(properties: AMQP.BasicProperties, body: ByteArray) {
            try {
                to.arrived(Messages.eventOf(properties, body))
            } catch (@Suppress("TooGenericExceptionCaught") unreadable: Exception) {
                faults.report(Fault(follower, "a message from the broker it could not read as an event", unreadable))
            }
        }

        /** Its queue is gone: said once, and made again until it can be, the history read once more each time. */
        private fun lost(why: Exception) {
            faults.report(Fault(follower, "its queue on RabbitMQ, which it makes again and reads the history", why))
            val gone = connection
            thread(name = "villages: $follower listening again", isDaemon = true) {
                runCatching { gone?.takeIf { it.isOpen }?.close() }
                var wait = FIRST_WAIT_MS
                while (!closed) {
                    try {
                        to.missed { open("$follower.${UUID.randomUUID().toString().take(8)}") }
                        return@thread
                    } catch (@Suppress("TooGenericExceptionCaught", "SwallowedException") notYet: Exception) {
                        Thread.sleep(wait)
                        wait = (wait * 2).coerceAtMost(LONGEST_WAIT_MS)
                    }
                }
            }
        }

        override fun close() {
            closed = true
            runCatching { connection?.takeIf { it.isOpen }?.close() }
        }
    }

    private companion object {
        const val FIRST_WAIT_MS = 200L
        const val LONGEST_WAIT_MS = 5_000L
    }
}
