package villages.occurrent

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import villages.domain.HouseEvent
import villages.domain.HouseFounded
import java.io.File

/**
 * The type table, the sealed hierarchy and docs/EVENTS.md are three statements of the same list, and this
 * holds them to each other. The domain has its own test against the catalogue; this one adds the store's
 * mapping, which is the thing that actually names an event on disk.
 */
class EventTypeCatalogueSpec : StringSpec({
    val catalogue = File("../../docs/EVENTS.md").readText()
    // Character classes rather than backslash escapes, so the pattern survives every quoting on the way in.
    val catalogued = Regex("""`(villages[.]house[.][a-zA-Z]+[.]v[0-9]+)`""").findAll(catalogue).map { it.groupValues[1] }.toSet()

    "every HouseEvent has a catalogued type in the table" {
        HouseEventTypes.rows.keys shouldContainExactlyInAnyOrder HouseEvent::class.sealedSubclasses
    }

    "every type in the table is in docs/EVENTS.md, and nothing in the catalogue is missing from the table" {
        HouseEventTypes.rows.values.toSet() shouldBe catalogued
    }

    "the mapping runs both ways" {
        HouseEventTypes.getCloudEventType(HouseFounded::class.java) shouldBe "villages.house.founded.v1"
        HouseEventTypes.getDomainEventType<HouseFounded>("villages.house.founded.v1") shouldBe HouseFounded::class.java
    }
})
