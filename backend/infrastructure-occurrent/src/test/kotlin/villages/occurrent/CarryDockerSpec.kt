package villages.occurrent

import io.kotest.core.spec.style.StringSpec
import io.kotest.core.test.Enabled
import io.kotest.core.test.TestCase
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import org.testcontainers.DockerClientFactory
import org.testcontainers.mongodb.MongoDBContainer
import villages.application.Fault
import villages.application.FaultBoard
import villages.application.Provenance
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
import java.util.concurrent.atomic.AtomicInteger

/**
 * The store followed durably, which the bridge to the broker rides (decision record 0094): handed every event written
 * since its name first followed the store, its place kept in MongoDB, so nothing written while it was not running is
 * missed. Against a replica set of the spec's own, each case in a database of its own.
 *
 * It needs Docker, says so in its names, and is skipped with the reason when Docker is not running.
 */
class CarryDockerSpec : StringSpec({
    val docker = DockerClientFactory.instance().isDockerAvailable
    val needsDocker: (TestCase) -> Enabled = {
        if (docker) Enabled.enabled else Enabled.disabled("needs Docker, and Docker is not running")
    }

    val mongo by lazy { MongoDBContainer("mongo:8.0").withReplicaSet().also { it.start() } }
    afterSpec { if (docker) mongo.stop() }

    fun heardOn(board: FaultBoard) = CopyOnWriteArrayList<Fault>().also { heard -> board.watch { heard += it } }

    "a carrier is handed what was written while it was not running, once, when it runs again (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            val carried = CopyOnWriteArrayList<String>()
            val houses = List(3) { HouseId(UUID.randomUUID()) }

            MongoWorld(mongo.connectionString, "villages-carry-resumes").use { world ->
                world.carry("bridge") { carried += it.getExtension(STREAM_ID).toString() }.use {
                    world.executor.execute(founding(houses[0]), told())
                    waitFor("the first founding carried") { carried.size == 1 }
                }
                // Written while nothing carries: the place kept is before it.
                world.executor.execute(founding(houses[1]), told())
            }
            MongoWorld(mongo.connectionString, "villages-carry-resumes").use { world ->
                world.carry("bridge") { carried += it.getExtension(STREAM_ID).toString() }.use {
                    waitFor("the founding written meanwhile carried") { carried.size == 2 }
                    world.executor.execute(founding(houses[2]), told())
                    waitFor("the third founding carried") { carried.size == 3 }
                }
            }

            carried shouldBe houses.map { it.stream }
        }

    "a carrier is handed the same event again until it returns, which is said once (needs Docker)"
        .config(enabledOrReasonIf = needsDocker) {
            val faults = FaultBoard()
            val heard = heardOn(faults)
            val carried = CopyOnWriteArrayList<String>()
            val tries = AtomicInteger()
            val house = HouseId(UUID.randomUUID())

            MongoWorld(mongo.connectionString, "villages-carry-again", faults).use { world ->
                world.carry("bridge") { cloudEvent ->
                    check(tries.incrementAndGet() > 2) { "the broker is not answering" }
                    carried += cloudEvent.getExtension(STREAM_ID).toString()
                }.use {
                    world.executor.execute(founding(house), told())
                    waitFor("the founding carried at the third try") { carried.isNotEmpty() }
                    Thread.sleep(300)
                }
            }

            carried shouldBe listOf(house.stream)
            heard shouldHaveSize 1
            heard.single().source shouldBe "bridge"
            heard.single().about shouldBe "an event it hands on again until it is carried"
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
