package villages.domain

import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import java.io.File
import kotlin.reflect.KClass
import kotlin.reflect.full.isSubclassOf
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

    /**
     * The events themselves, under whichever sealed parts of the hierarchy they sit in. Each is reached
     * twice, once through the stream it is kept on and once through the half it belongs to, so the
     * duplicates go.
     */
    fun leaves(of: KClass<out Event>): List<KClass<out Event>> =
        of.sealedSubclasses.flatMap { if (it.isSealed) leaves(it) else listOf(it) }.distinct()

    /**
     * Every kind of stream an event can be kept on, and the word its world events are catalogued under. A
     * new kind of stream is a row here; until it has one, the test below says its events are kept nowhere.
     */
    val streams: Map<KClass<out Event>, String> =
        mapOf(
            HouseEvent::class to "house",
            CharacterEvent::class to "character",
            StructureEvent::class to "structure",
            WorldStreamEvent::class to "world",
        )

    fun streamOf(event: KClass<out Event>): KClass<out Event> = streams.keys.single { event.isSubclassOf(it) }

    /** The rule the code names events by, which this test holds the catalogue to. See [EventNames]. */
    fun catalogueNameOf(event: KClass<out Event>): String = EventNames.nameOf(event)

    "every event in the code has a row in the catalogue, and every row has an event" {
        val inCode = leaves(Event::class).map(::catalogueNameOf).sorted()
        val inCatalogue = rows.keys.map { type -> type.substringBeforeLast(".v") }.distinct().sorted()

        inCatalogue shouldContainExactly inCode
    }

    "every row's payload lists exactly the event's fields, in the order they are declared" {
        for (event in leaves(Event::class)) {
            val fields = event.primaryConstructor!!.parameters.map { it.name!! }
            val named = catalogueNameOf(event)
            val listed = rows.entries.single { it.key.startsWith("$named.v") }.value

            listed shouldContainExactly fields
        }
    }

    /**
     * Where an event is kept and what kind of thing it is are separate questions, and both need exactly
     * one answer: an event on no stream could not be read back, and one on two would be two histories'.
     * See decision record 0055.
     */
    "every event is kept on exactly one kind of stream" {
        for (event in leaves(Event::class)) {
            withClue(event.simpleName) {
                streams.keys.count { event.isSubclassOf(it) } shouldBe 1
            }
        }
    }

    /**
     * The two halves of decision record 0034, held apart. A player's event catalogued as the world's
     * would say a mechanic of play was a happening in the world, which is the distinction this exists
     * to keep.
     */
    "a player's event is named and catalogued as the player's, and the world's for the stream it is on" {
        for (event in leaves(PlayerEvent::class)) {
            event.simpleName!! shouldStartWith "Player"
            catalogueNameOf(event) shouldStartWith "villages.player."
        }
        for (event in leaves(WorldEvent::class)) {
            val whose = streams.getValue(streamOf(event))
            event.simpleName!! shouldStartWith whose.capitalised()
            catalogueNameOf(event) shouldStartWith "villages.$whose."
        }
    }

    "and every event is in one half or the other, so none of them is unplaced" {
        val halves = leaves(PlayerEvent::class) + leaves(WorldEvent::class)

        halves.sortedBy { it.simpleName } shouldBe leaves(Event::class).sortedBy { it.simpleName }
    }
})

private fun String.capitalised(): String = replaceFirstChar { it.uppercase() }
