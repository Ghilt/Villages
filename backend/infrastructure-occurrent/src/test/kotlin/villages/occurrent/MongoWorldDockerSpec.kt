package villages.occurrent

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import io.kotest.core.test.Enabled
import io.kotest.core.test.TestCase
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.occurrent.eventstore.api.WriteCondition
import org.occurrent.eventstore.api.WriteConditionNotFulfilledException
import org.testcontainers.DockerClientFactory
import org.testcontainers.mongodb.MongoDBContainer
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
import java.time.Instant
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * The world kept in MongoDB, against a real one: a replica set of the spec's own in a container, thrown away
 * after it, which is what `TESTING.md` asks of a test that needs infrastructure. Each case keeps to a database
 * of its own, as each tree does (decision record 0091).
 *
 * It needs Docker, says so in its name, and is skipped with the reason when Docker is not running.
 */
class MongoWorldDockerSpec : StringSpec({
    val docker = DockerClientFactory.instance().isDockerAvailable
    val needsDocker: (TestCase) -> Enabled = {
        if (docker) Enabled.enabled else Enabled.disabled("needs Docker, and Docker is not running")
    }

    // The image infra/docker-compose.yml runs, so the store is tested on the MongoDB the game keeps its world in.
    val mongo by lazy { MongoDBContainer("mongo:8.0").withReplicaSet().also { it.start() } }
    afterSpec { if (docker) mongo.stop() }

    fun world(database: String) = MongoWorld(mongo.connectionString, database)

    val ravenscar = FoundHouse(
        houseId = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a")),
        player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d")),
        name = HouseName("Ravenscar"),
        seat = Location(59.33, 18.07),
        banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
        worldTime = WorldTime(454901),
        recordedAt = Instant.parse("2026-09-04T12:00:00.123456789Z"),
    )
    val sent = Provenance(
        commandId = UUID.fromString("1c000001-0000-4000-8000-00000000000a"),
        correlationId = UUID.fromString("57000000-0000-4000-8000-0000000000ff"),
    )

    /** Everything the world holds, as a read model starting up would be handed it. */
    fun everything(world: MongoWorld): List<StoredEvent> = CopyOnWriteArrayList<StoredEvent>().also { heard ->
        world.feed.subscribe(Start.FROM_THE_BEGINNING) { heard += it }.close()
    }

    "every catalogued event is read back from MongoDB exactly as it was written (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            world("villages-samples").use { world ->
                val converter = Events.converter()
                val written = EventSamples.samples.entries.mapIndexed { index, (type, event) ->
                    val cloudEvent = converter.toCloudEvent(event).stamped(sent)
                    world.store.write("sample-$index", listOf(cloudEvent))
                    Triple(type, event, cloudEvent)
                }

                val read = everything(world).associateBy { it.id }

                read.values shouldHaveSize written.size
                for ((type, event, cloudEvent) in written) {
                    withClue(type) {
                        val stored = read.getValue(cloudEvent.id)
                        stored.type shouldBe type
                        stored.event shouldBe event
                        stored.time shouldBe cloudEvent.time!!.toInstant()
                        Events.json.readTree(stored.data) shouldBe Events.json.readTree(cloudEvent.data!!.toBytes())
                        stored.correlationId shouldBe sent.correlationId.toString()
                        stored.causationId shouldBe sent.commandId.toString()
                        stored.streamVersion shouldBe 1L
                    }
                }
            }
        }

    "a command run through the port is stored and delivered on the feed as it happens (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            world("villages-live").use { world ->
                val heard = CopyOnWriteArrayList<StoredEvent>()
                val arrived = CountDownLatch(1)
                world.feed.subscribe(Start.FROM_NOW) { heard += it; arrived.countDown() }.use {
                    world.executor.execute(ravenscar, sent)

                    arrived.await(10, TimeUnit.SECONDS) shouldBe true
                    heard.first().type shouldBe "villages.house.founded.v1"
                    heard.first().stream shouldBe ravenscar.houseId.stream
                }
            }
        }

    "a world opened again on the same database has everything the last one wrote (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            val before = world("villages-restart").use { world ->
                world.executor.execute(ravenscar, sent)
                everything(world).map { it.id }
            }

            world("villages-restart").use { again ->
                everything(again).map { it.id } shouldBe before
            }
        }

    "two databases are two worlds, and neither sees nor wipes the other (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            world("villages-one-tree").use { one ->
                world("villages-another-tree").use { another ->
                    one.executor.execute(ravenscar, sent)

                    everything(another).shouldBeEmpty()
                    another.wipe() shouldBe 0
                    everything(one).map { it.stream }.toSet() shouldBe setOf(ravenscar.houseId.stream)
                }
            }
        }

    "the wipe empties the world and counts what went (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            world("villages-wipe").use { world ->
                world.executor.execute(ravenscar, sent)
                val held = everything(world).size

                world.wipe() shouldBe held
                everything(world).shouldBeEmpty()
            }
        }

    "a write against a version somebody else has moved past is refused, which is what a retry hangs on (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            world("villages-conflict").use { world ->
                world.executor.execute(ravenscar, sent)
                val late = Events.converter().toCloudEvent(EventSamples.samples.values.first()).stamped(sent)

                shouldThrow<WriteConditionNotFulfilledException> {
                    world.store.write(ravenscar.houseId.stream, WriteCondition.streamVersionEq(0), listOf(late))
                }
            }
        }

    "a MongoDB that does not answer is said in words, with where it runs, and needs no Docker to say so" {
        val refused = shouldThrow<IllegalStateException> {
            MongoWorld("mongodb://localhost:1/?serverSelectionTimeoutMS=300", "villages-nowhere")
        }

        refused.message shouldContain "MongoDB did not answer at mongodb://localhost:1"
        refused.message shouldContain "docker compose -f infra/docker-compose.yml up -d"
    }
})
