package villages.rabbit

import villages.application.EventFeed
import villages.occurrent.EventWorld
import villages.occurrent.MongoWorld

/**
 * A world kept in MongoDB and carried by RabbitMQ: every event it stores published to `villages.events` in the
 * tree's own virtual host by the bridge, which follows the store durably, so that nothing is lost across a restart
 * of the server or of the broker. Starting one makes the virtual host and declares the exchange first, and a broker
 * that does not answer stops it. The read models and the gateway then follow the broker, each through a queue of
 * its own, and the reactions the store itself. Everything else is the world's own. See decision record 0094.
 *
 * Only a world in MongoDB is carried: in memory, a wipe's wait cannot see what the broker still holds.
 */
class CarriedWorld(private val world: MongoWorld, broker: Broker, keys: RoutingKeys) : EventWorld by world {
    private val bridge = Bridge(broker, keys)
    private val carrier: AutoCloseable

    init {
        broker.prepare()
        carrier = world.carry(BRIDGE) { bridge.carry(it, world.eventIn(it)) }
    }

    override val keptIn = "${world.keptIn}, and carried by RabbitMQ in the virtual host ${broker.virtualHost}"

    /** The read models and the gateway follow the broker, each through a queue of its own, once the bridge runs. */
    override val feed: EventFeed = world.follow(BrokerLive(broker, world.faults))

    /** The reactions follow the store, so a broker that is away stops only the view of the world. */
    override val storeFeed: EventFeed = world.feed

    override fun close() {
        carrier.close()
        bridge.close()
        world.close()
    }

    private companion object {
        /** The name the bridge keeps its place in `checkpoints` under. */
        const val BRIDGE = "bridge"
    }
}
