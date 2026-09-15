package villages.domain

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import java.io.File
import kotlin.reflect.KClass
import kotlin.reflect.full.primaryConstructor

/**
 * The code and docs/EVENTS.md must agree, in both directions. Every event has a row whose type is
 * `villages.<whose>.<verb>.v<n>` and whose payload lists exactly the event's fields; every row has an
 * event. The CloudEvent type mapping proper is tested with the event store; this holds the catalogue
 * honest from the day the first event exists.
 *
 * Every table in the file is read, wherever it sits, so the catalogue can be arranged for a reader
 * rather than for this parser.
 */
class EventCatalogueSpec : StringSpec({
    val catalogue = File("../../docs/EVENTS.md").readText()

    /** Every catalogued type, and the field names its payload cell lists, in the order it lists them. */
    val rows: Map<String, List<String>> =
        Regex("""^\|\s*`(villages\.[a-z]+\.[a-zA-Z]+\.v\d+)`\s*\|\s*([^|]*)\|""", RegexOption.MULTILINE)
            .findAll(catalogue)
            .associate { row ->
                row.groupValues[1] to
                    Regex("`([a-zA-Z]+)`").findAll(row.groupValues[2]).map { it.groupValues[1] }.toList()
            }

    /** The events themselves, under whichever sealed halves of the hierarchy they sit in. */
    fun leaves(of: KClass<out HouseEvent>): List<KClass<out HouseEvent>> =
        of.sealedSubclasses.flatMap { if (it.isSealed) leaves(it) else listOf(it) }

    /**
     * `HouseFounded` is catalogued as `villages.house.founded`, `PlayerGivenChoice` as
     * `villages.player.givenChoice`: whose event it is, then the verb, camelCase because not every fact
     * is one word. The version is the catalogue's to say, so it is not derived here.
     */
    fun catalogueNameOf(event: KClass<out HouseEvent>): String {
        val named = event.simpleName!!
        val whose = if (named.startsWith("Player")) "player" else "house"
        val verb = named.removePrefix("Player").removePrefix("House").replaceFirstChar { it.lowercase() }
        return "villages.$whose.$verb"
    }

    "every event in the code has a row in the catalogue, and every row has an event" {
        val inCode = leaves(HouseEvent::class).map(::catalogueNameOf).sorted()
        val inCatalogue = rows.keys.map { type -> type.substringBeforeLast(".v") }.distinct().sorted()

        inCatalogue shouldContainExactly inCode
    }

    "every row's payload lists exactly the event's fields, in the order they are declared" {
        for (event in leaves(HouseEvent::class)) {
            val fields = event.primaryConstructor!!.parameters.map { it.name!! }
            val named = catalogueNameOf(event)
            val listed = rows.entries.single { it.key.startsWith("$named.v") }.value

            listed shouldContainExactly fields
        }
    }

    /**
     * The two halves of decision record 0034, held apart. A player's event catalogued as the world's
     * would say a mechanic of play was a happening in the world, which is the distinction this exists
     * to keep.
     */
    "a player's event is named and catalogued as the player's, and the world's as the world's" {
        for (event in leaves(PlayerEvent::class)) {
            event.simpleName!! shouldStartWith "Player"
            catalogueNameOf(event) shouldStartWith "villages.player."
        }
        for (event in leaves(WorldEvent::class)) {
            event.simpleName!! shouldStartWith "House"
            catalogueNameOf(event) shouldStartWith "villages.house."
        }
    }

    "and every event is in one half or the other, so none of them is unplaced" {
        val halves = leaves(PlayerEvent::class) + leaves(WorldEvent::class)

        halves.sortedBy { it.simpleName } shouldBe leaves(HouseEvent::class).sortedBy { it.simpleName }
    }
})
