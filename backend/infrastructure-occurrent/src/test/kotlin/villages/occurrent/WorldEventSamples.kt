package villages.occurrent

import villages.domain.Event
import villages.domain.WorldCatalogueChanged
import villages.domain.WorldTime
import java.time.Instant

/** A sample of every event on the world's own stream, each pinned to its fixture as the rest are. See 0097. */
internal object WorldEventSamples {
    private val noon = Instant.parse("2026-09-04T12:00:00Z")

    /** A castle's yield retuned: the world's own stream taking on a version of a catalogue it had not recorded. */
    val structuresRetuned = WorldCatalogueChanged(
        catalogue = "structures",
        fingerprint = "b".repeat(64),
        previous = "a".repeat(64),
        changed = listOf("types.castle.yields.naturalDomain"),
        text = "{ \"types\": { \"castle\": { \"yields\": { \"naturalDomain\": [4, 5, 8] } } } }\n",
        worldTime = WorldTime(653_712),
        recordedAt = noon,
    )

    val samples: Map<String, Event> = mapOf(
        "villages.world.catalogueChanged.v1" to structuresRetuned,
    )
}
