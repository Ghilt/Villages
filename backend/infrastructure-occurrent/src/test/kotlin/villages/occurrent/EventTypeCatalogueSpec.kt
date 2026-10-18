package villages.occurrent

import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import villages.domain.Event
import villages.domain.HouseFounded
import villages.domain.PlayerTookAction
import java.io.File
import kotlin.reflect.KClass

/**
 * The type table, the sealed hierarchy and docs/EVENTS.md are three statements of the same list, and this
 * holds them to each other. The domain has its own test against the catalogue; this one adds the store's
 * mapping, which is the thing that actually names an event on disk.
 */
class EventTypeCatalogueSpec : StringSpec({
    val catalogue = File("../../docs/EVENTS.md").readText()
    // Character classes rather than backslash escapes, so the pattern survives every quoting on the way in.
    val catalogued = Regex("""`(villages[.][a-z]+[.][a-zA-Z]+[.]v[0-9]+)`""")
        .findAll(catalogue)
        .map { it.groupValues[1] }
        .toSet()

    /** The events themselves, reached once through their stream and once through their half, so once each. */
    fun leaves(of: KClass<out Event>): List<KClass<out Event>> =
        of.sealedSubclasses.flatMap { if (it.isSealed) leaves(it) else listOf(it) }.distinct()

    "every event has a catalogued type in the table" {
        EventTypes.rows.keys shouldContainExactlyInAnyOrder leaves(Event::class)
    }

    "every type in the table is in docs/EVENTS.md, and nothing in the catalogue is missing from the table" {
        // A retired type stays in the catalogue for ever and is read through its upcasters, not the table (0100).
        EventTypes.rows.values.toSet() + Upcasters.ALL.steps.map { it.from } shouldBe catalogued
    }

    /**
     * A type is worked out from its class's name now, so renaming a class would rename what it is stored under and strand
     * every event stored before. `contracts/event-types.txt` remembers every type ever written, and each one must still be
     * written or carried by an upcaster; a new type is added to it in the commit that brings it. See 0100, and
     * `docs/plans/mechanic-modules.md`, step 2.
     */
    "every type ever written is still written or carried, and every type written is recorded" {
        val recorded = File("../../contracts/event-types.txt").readLines()
            .map(String::trim).filter { it.isNotEmpty() && !it.startsWith("#") }.toSet()
        val readable = EventTypes.rows.values.toSet() + Upcasters.ALL.steps.map { it.from }

        withClue("recorded, and neither written nor carried by an upcaster any more") { (recorded - readable) shouldBe emptySet() }
        withClue("written, and not yet in contracts/event-types.txt") { (EventTypes.rows.values.toSet() - recorded) shouldBe emptySet() }
    }

    "the mapping runs both ways, for the world's events and the player's alike" {
        EventTypes.getCloudEventType(HouseFounded::class.java) shouldBe "villages.house.founded.v1"
        EventTypes.getDomainEventType<HouseFounded>("villages.house.founded.v1") shouldBe HouseFounded::class.java

        EventTypes.getCloudEventType(PlayerTookAction::class.java) shouldBe "villages.player.tookAction.v1"
        EventTypes.getDomainEventType<PlayerTookAction>("villages.player.tookAction.v1") shouldBe
            PlayerTookAction::class.java
    }
})
