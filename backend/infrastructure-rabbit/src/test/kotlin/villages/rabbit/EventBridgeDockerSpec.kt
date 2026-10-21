package villages.rabbit

import com.rabbitmq.client.GetResponse
import io.kotest.core.spec.style.StringSpec
import io.kotest.core.test.Enabled
import io.kotest.core.test.TestCase
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import org.testcontainers.DockerClientFactory
import villages.application.Fault
import villages.application.FaultBoard
import villages.application.Provenance
import villages.application.Start
import villages.application.StoredEvent
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.FoundHouse
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Tincture
import villages.domain.WorldTime
import villages.occurrent.MongoWorld
import java.time.Instant
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit

/**
 * The event bridge from the store to the broker (decision record 0094), against a MongoDB and a RabbitMQ of the spec's own:
 * every stored event published once, under its key, as the store holds it, and nothing lost while the event bridge or the
 * broker is down. What it publishes is read from a queue of the spec's own, bound to everything and durable, so that
 * it outlives the event bridge's connections and the broker's restart.
 *
 * It needs Docker, says so in its names, and is skipped with the reason when Docker is not running.
 */
class EventBridgeDockerSpec : StringSpec({
    val docker = DockerClientFactory.instance().isDockerAvailable
    val needsDocker: (TestCase) -> Enabled = {
        if (docker) Enabled.enabled else Enabled.disabled("needs Docker, and Docker is not running")
    }

    val mongo by lazy { DockerStack.mongo }
    val rabbit by lazy { DockerStack.rabbit }

    val keys = RoutingKeys { "1203" }

    fun broker(tree: String) =
        Broker("amqp://villages:villages@${rabbit.host}:${rabbit.amqpPort}", rabbit.httpUrl, tree).apply { prepare() }

    /** A queue of the spec's own, bound to everything, which outlives every connection and the broker's restart. */
    fun everything(broker: Broker): String = broker.connect("the spec").use { connection ->
        connection.createChannel().use { channel ->
            channel.queueDeclare("the spec's", true, false, false, null)
            channel.queueBind("the spec's", Broker.EXCHANGE, "#")
        }
        "the spec's"
    }

    /** Waits until [queue] holds [count], then takes them all. */
    fun taken(broker: Broker, queue: String, count: Int): List<GetResponse> {
        val giveUp = System.nanoTime() + TimeUnit.SECONDS.toNanos(30)
        broker.connect("the spec").use { connection ->
            connection.createChannel().use { channel ->
                while (channel.messageCount(queue) < count) {
                    check(System.nanoTime() < giveUp) { "gave up waiting for $count in $queue" }
                    Thread.sleep(20)
                }
                return generateSequence { channel.basicGet(queue, true) }.toList()
            }
        }
    }

    fun bridged(world: MongoWorld, broker: Broker): AutoCloseable {
        val eventBridge = EventBridge(broker, keys)
        val carrier = world.carry("bridge") { eventBridge.carry(it, world.eventIn(it)) }
        return AutoCloseable {
            carrier.close()
            eventBridge.close()
        }
    }

    fun streamOf(message: GetResponse) = message.props.headers.getValue("streamid").toString()

    "every event written is published once, under its key, as the store holds it (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            val broker = broker("villages-bridge-key")
            val queue = everything(broker)
            val house = HouseId(UUID.randomUUID())

            MongoWorld(mongo.connectionString, "villages-bridge-key").use { world ->
                bridged(world, broker).use {
                    world.executor.execute(founding(house), told())
                    val published = taken(broker, queue, 1).single()

                    val stored = CopyOnWriteArrayList<StoredEvent>()
                    world.feed.subscribe(Start.FROM_THE_BEGINNING) { stored += it }.close()
                    val carried = Messages.eventOf(published.props, published.body)
                    published.envelope.routingKey shouldBe "house.founded.v1.1.2.0.3"
                    with(stored.single()) {
                        carried.id shouldBe id
                        carried.type shouldBe type
                        carried.getExtension("streamid") shouldBe stream
                        carried.getExtension("streamversion") shouldBe streamVersion
                        carried.time!!.toInstant() shouldBe time
                        String(carried.data!!.toBytes()) shouldBe data
                        carried.getExtension("correlationid") shouldBe correlationId
                        carried.getExtension("causationid") shouldBe causationId
                    }
                    Thread.sleep(300)
                    taken(broker, queue, 0) shouldHaveSize 0
                }
            }
        }

    "an event written while the event bridge was down is published when it is back, and nothing twice (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            val broker = broker("villages-bridge-down")
            val queue = everything(broker)
            val houses = List(2) { HouseId(UUID.randomUUID()) }
            val published = mutableListOf<GetResponse>()

            MongoWorld(mongo.connectionString, "villages-bridge-down").use { world ->
                bridged(world, broker).use {
                    world.executor.execute(founding(houses[0]), told())
                    published += taken(broker, queue, 1)
                }
                world.executor.execute(founding(houses[1]), told())
                bridged(world, broker).use {
                    published += taken(broker, queue, 1)
                    Thread.sleep(300)
                    published += taken(broker, queue, 0)
                }
            }

            published.map(::streamOf) shouldBe houses.map { it.stream }
        }

    "the wipe's marker is published as feed.marker.none (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            val broker = broker("villages-bridge-wipe")
            val queue = everything(broker)

            MongoWorld(mongo.connectionString, "villages-bridge-wipe").use { world ->
                bridged(world, broker).use {
                    world.wipe()
                    val marker = taken(broker, queue, 1).single()

                    marker.envelope.routingKey shouldBe "feed.marker.none"
                    marker.props.type shouldBe "villages.feed.marker"
                }
            }
        }

    "a world carried by RabbitMQ says so, and what it stores reaches its own virtual host (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            val broker = broker("villages-carried")
            val queue = everything(broker)
            val house = HouseId(UUID.randomUUID())

            CarriedWorld(MongoWorld(mongo.connectionString, "villages-carried"), broker, keys).use { world ->
                world.keptIn shouldBe "in MongoDB, database villages-carried, which outlives the server, " +
                    "and carried by RabbitMQ in the virtual host villages-carried"
                world.executor.execute(founding(house), told())

                taken(broker, queue, 1).map(::streamOf) shouldBe listOf(house.stream)
            }
        }

    "a broker stopped and started again loses nothing, and the event bridge says so once (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            val broker = broker("villages-bridge-restart")
            val queue = everything(broker)
            val houses = List(2) { HouseId(UUID.randomUUID()) }
            val faults = FaultBoard()
            val heard = CopyOnWriteArrayList<Fault>().also { heard -> faults.watch { heard += it } }

            MongoWorld(mongo.connectionString, "villages-bridge-restart", faults).use { world ->
                bridged(world, broker).use {
                    world.executor.execute(founding(houses[0]), told())
                    taken(broker, queue, 1)
                    rabbit.execInContainer("rabbitmqctl", "stop_app")
                    try {
                        world.executor.execute(founding(houses[1]), told())
                        Thread.sleep(2_000)
                    } finally {
                        rabbit.execInContainer("rabbitmqctl", "start_app")
                    }

                    taken(broker, queue, 1).map(::streamOf) shouldBe listOf(houses[1].stream)
                }
            }

            heard.filter { it.source == "bridge" } shouldHaveSize 1
        }
})

private fun told(): Provenance = UUID.randomUUID().let { Provenance(commandId = it, correlationId = it) }

private fun founding(house: HouseId) = FoundHouse(
    houseId = house,
    player = PlayerId(UUID.randomUUID()),
    name = HouseName("Ravenscar"),
    seat = Location(59.33, 18.07),
    banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
    worldTime = WorldTime(454901),
    recordedAt = Instant.parse("2026-09-04T12:00:00Z"),
)
