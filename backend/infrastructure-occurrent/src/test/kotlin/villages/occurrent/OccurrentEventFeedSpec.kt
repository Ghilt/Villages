package villages.occurrent

import io.cloudevents.CloudEvent
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.application.FaultBoard
import villages.application.Provenance
import villages.application.Start
import villages.application.WipeGate
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.FoundHouse
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Tincture
import villages.domain.WorldTime
import java.time.Duration
import java.time.Instant
import java.util.Collections
import java.util.UUID
import kotlin.concurrent.thread

/**
 * The feed over any live half: here one driven by hand, so that a marker can be made to arrive at the moment that
 * matters, while the history is still being read. The broker's live half (decision record 0094) is the same code.
 */
class OccurrentEventFeedSpec : StringSpec({
    "a marker that arrives while the history is read is reached only once the history is handed on" {
        val world = InMemoryWorld()
        listOf("Ravenscar", "Hollin").forEach { name ->
            val id = UUID.randomUUID()
            world.executor.execute(founding(name), Provenance(commandId = id, correlationId = id))
        }
        val markers = Markers()
        var arrive: (CloudEvent) -> Unit = {}
        val byHand = Live { _, arrived -> arrive = arrived; AutoCloseable {} }
        val feed = OccurrentEventFeed(byHand, world.store, world.converter, FaultBoard(), WipeGate(), markers)

        val happened = Collections.synchronizedList(mutableListOf<String>())
        val marker = aMarker()
        var waiting: Thread? = null
        feed.subscribe(Start.FROM_THE_BEGINNING) { stored ->
            if (waiting == null) {
                // A wipe begins: it waits for the marker on a thread of its own, and the marker arrives live.
                markers.expect(marker.id)
                waiting = thread { if (markers.awaitAll(marker.id, Duration.ofSeconds(10))) happened += "reached" }
                arrive(marker)
                // Long enough for a marker reached on arriving to have been said before the history goes on.
                Thread.sleep(200)
            }
            happened += (stored.event as HouseFounded).name.value
        }.use { waiting!!.join() }

        happened shouldBe listOf("Ravenscar", "Hollin", "reached")
        world.close()
    }
})

private fun founding(name: String) = FoundHouse(
    houseId = HouseId(UUID.randomUUID()),
    player = PlayerId(UUID.randomUUID()),
    name = HouseName(name),
    seat = Location(59.33, 18.07),
    banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
    worldTime = WorldTime(454901),
    recordedAt = Instant.parse("2026-09-04T12:00:00Z"),
)
