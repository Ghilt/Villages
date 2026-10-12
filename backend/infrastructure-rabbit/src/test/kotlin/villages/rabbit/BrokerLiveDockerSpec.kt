package villages.rabbit

import io.kotest.core.spec.style.StringSpec
import io.kotest.core.test.Enabled
import io.kotest.core.test.TestCase
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import org.testcontainers.DockerClientFactory
import org.testcontainers.mongodb.MongoDBContainer
import org.testcontainers.rabbitmq.RabbitMQContainer
import villages.application.Fault
import villages.application.FaultBoard
import villages.application.NamedSubscriber
import villages.application.Provenance
import villages.application.Resettable
import villages.application.Start
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
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Instant
import java.util.Base64
import java.util.Collections
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * The broker feed (decision record 0094): a follower handed the history from the store and then what the bridge
 * publishes, through a queue of its own, against a MongoDB and a RabbitMQ of the spec's own. Nothing missed, nothing
 * twice, a wipe that waits for it, and a broker that goes away caught up from the store.
 *
 * It needs Docker, says so in its names, and is skipped with the reason when Docker is not running.
 */
class BrokerLiveDockerSpec : StringSpec({
    val docker = DockerClientFactory.instance().isDockerAvailable
    val needsDocker: (TestCase) -> Enabled = {
        if (docker) Enabled.enabled else Enabled.disabled("needs Docker, and Docker is not running")
    }

    val mongo by lazy { MongoDBContainer("mongo:8.0").withReplicaSet().also { it.start() } }
    val rabbit by lazy {
        RabbitMQContainer("rabbitmq:4.3-management").withAdminUser("villages").withAdminPassword("villages")
            .also { it.start() }
    }
    afterSpec {
        if (docker) {
            mongo.stop()
            rabbit.stop()
        }
    }

    /** A world carried by RabbitMQ, the bridge running, and a feed over it that follows the broker. */
    class Carried(val world: MongoWorld, val carried: CarriedWorld, val faults: FaultBoard, broker: Broker) : AutoCloseable {
        val feed = world.follow(BrokerLive(broker, faults))
        override fun close() = carried.close()
    }

    fun carried(tree: String): Carried {
        val faults = FaultBoard()
        val broker = Broker("amqp://villages:villages@${rabbit.host}:${rabbit.amqpPort}", rabbit.httpUrl, tree)
        val world = MongoWorld(mongo.connectionString, tree, faults)
        return Carried(world, CarriedWorld(world, broker, RoutingKeys { "1203" }), faults, broker)
    }

    /** The names of the queues in a virtual host, as the management page lists them. */
    fun queuesIn(tree: String): List<String> {
        val asked = HttpRequest.newBuilder(URI("${rabbit.httpUrl}/api/queues/$tree?columns=name"))
            .header("Authorization", "Basic " + Base64.getEncoder().encodeToString("villages:villages".toByteArray()))
            .build()
        val answer = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build()
            .send(asked, HttpResponse.BodyHandlers.ofString()).body()
        return Regex(""""name":"([^"]+)"""").findAll(answer).map { it.groupValues[1] }.toList()
    }

    fun found(world: MongoWorld): HouseId = HouseId(UUID.randomUUID()).also { house ->
        world.executor.execute(founding(house), Provenance(commandId = house.value, correlationId = house.value))
    }

    "a follower is handed the history and everything written while it starts, once each, from many threads (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            carried("villages-broker-many").use { tree ->
                val before = List(10) { found(tree.world) }
                val during = Collections.synchronizedList(mutableListOf<HouseId>())
                val handed = Collections.synchronizedList(mutableListOf<String>())

                val writers = List(4) { thread { repeat(10) { during += found(tree.world) } } }
                tree.feed.subscribe(Start.FROM_THE_BEGINNING) { handed += it.stream }.use {
                    writers.forEach(Thread::join)
                    waitFor("all fifty handed") { handed.size >= 50 }
                    Thread.sleep(300)
                }

                handed shouldHaveSize 50
                handed shouldContainExactlyInAnyOrder (before + during).map { it.stream }
            }
        }

    "a follower from now is handed only what is written after it begins (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            carried("villages-broker-now").use { tree ->
                found(tree.world)
                val handed = CopyOnWriteArrayList<String>()

                tree.feed.subscribe(Start.FROM_NOW) { handed += it.stream }.use {
                    val after = found(tree.world)
                    waitFor("the one written after handed") { handed.isNotEmpty() }
                    Thread.sleep(300)
                    handed shouldBe listOf(after.stream)
                }
            }
        }

    "a wipe waits for the broker's followers, and leaves no house behind in what they fold (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            carried("villages-broker-wipe").use { tree ->
                val folded = Collections.synchronizedSet(mutableSetOf<String>())
                // Slow on purpose, so the wipe begins while most of what was written is still on its way.
                val slow = tree.feed.subscribe(Start.FROM_THE_BEGINNING) { stored ->
                    Thread.sleep(20)
                    folded += stored.stream
                }
                slow.use {
                    repeat(30) { found(tree.world) }
                    tree.carried.wipe(listOf(Resettable { folded.clear() }))
                    folded.shouldBeEmpty()
                    Thread.sleep(1_000)
                    folded.shouldBeEmpty()
                }
            }
        }

    "a world carried by RabbitMQ: the read models follow it by a queue named after each, the reactions the store (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            carried("villages-broker-who").use { tree ->
                val handed = CopyOnWriteArrayList<String>()
                tree.carried.feed.subscribe(Start.FROM_NOW, NamedSubscriber("HousesProjection") { handed += it.stream }).use {
                    tree.carried.storeFeed.subscribe(Start.FROM_NOW, NamedSubscriber("Seats") {}).use {
                        val house = found(tree.world)
                        waitFor("the founding handed through the broker") { handed.isNotEmpty() }

                        handed shouldBe listOf(house.stream)
                        queuesIn("villages-broker-who").map { it.substringBefore('.') } shouldBe listOf("HousesProjection")
                    }
                }
            }
        }

    "a broker stopped and started again: a follower is handed what it missed from the store, once, and says so once (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            carried("villages-broker-restart").use { tree ->
                val heard = CopyOnWriteArrayList<Fault>().also { heard -> tree.faults.watch { heard += it } }
                val handed = CopyOnWriteArrayList<String>()
                val first = found(tree.world)

                tree.feed.subscribe(Start.FROM_THE_BEGINNING, NamedSubscriber("Watching") { handed += it.stream }).use {
                    waitFor("the first handed") { handed.size == 1 }
                    rabbit.execInContainer("rabbitmqctl", "stop_app")
                    val missed = found(tree.world)
                    Thread.sleep(1_000)
                    rabbit.execInContainer("rabbitmqctl", "start_app")
                    waitFor("the one written while the broker was away handed") { handed.size >= 2 }
                    val after = found(tree.world)
                    waitFor("the one written after handed") { handed.size >= 3 }
                    Thread.sleep(300)

                    handed shouldBe listOf(first, missed, after).map { it.stream }
                }
                heard.filter { it.source == "Watching" } shouldHaveSize 1
            }
        }
})

/** Waits for something to be true, rather than for a length of time; a broker coming back takes some seconds. */
private fun waitFor(what: String, ready: () -> Boolean) {
    val giveUp = System.nanoTime() + TimeUnit.SECONDS.toNanos(30)
    while (!ready()) {
        check(System.nanoTime() < giveUp) { "gave up waiting for $what" }
        Thread.sleep(20)
    }
}

private fun founding(house: HouseId) = FoundHouse(
    houseId = house,
    player = PlayerId(UUID.randomUUID()),
    name = HouseName("Ravenscar"),
    seat = Location(59.33, 18.07),
    banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
    worldTime = WorldTime(454901),
    recordedAt = Instant.parse("2026-09-04T12:00:00Z"),
)
