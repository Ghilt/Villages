package villages.rabbit

import org.testcontainers.lifecycle.Startables
import org.testcontainers.mongodb.MongoDBContainer
import org.testcontainers.rabbitmq.RabbitMQContainer

/**
 * The one MongoDB and the one RabbitMQ every Docker spec of this module shares: both started together the first time a
 * spec asks for either, and left running until the tests' JVM ends, when Testcontainers' reaper stops them. A spec that
 * started a pair of its own spent ten seconds or so on each, and the module's specs had five to start between them
 * (2026-10-20).
 *
 * Sharing is safe because the specs run one after another and each keeps to databases and virtual hosts of names of its
 * own; a spec that stops RabbitMQ's app to test a restart starts it again in a `finally`, so a failure cannot leave the
 * next spec a broker that is down.
 */
object DockerStack {
    private val both by lazy {
        val mongo = MongoDBContainer("mongo:8.0").withReplicaSet()
        val rabbit = RabbitMQContainer("rabbitmq:4.3-management").withAdminUser("villages").withAdminPassword("villages")
        Startables.deepStart(mongo, rabbit).join()
        mongo to rabbit
    }

    val mongo: MongoDBContainer get() = both.first
    val rabbit: RabbitMQContainer get() = both.second
}
