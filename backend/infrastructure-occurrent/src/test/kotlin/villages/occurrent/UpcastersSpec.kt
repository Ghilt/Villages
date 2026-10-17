package villages.occurrent

import io.cloudevents.CloudEvent
import io.cloudevents.core.builder.CloudEventBuilder
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import tools.jackson.databind.JsonNode
import tools.jackson.databind.node.ObjectNode
import java.io.File
import java.net.URI
import java.time.OffsetDateTime

/**
 * The upcast stage between a stored event and the domain event: the rules every step the code knows must keep, and the
 * stage itself proved on a made-up retired type, since no real one is retired yet. See decision record 0100.
 */
class UpcastersSpec : StringSpec({
    val catalogued = EventTypes.rows.values.toSet()

    fun storedAs(type: String, pinned: JsonNode, data: JsonNode): CloudEvent = CloudEventBuilder.v1()
        .withId("5e000000-0000-4000-8000-000000000001")
        .withType(type)
        .withSource(URI.create(pinned["source"].asString()))
        .withSubject(pinned["subject"].asString())
        .withTime(OffsetDateTime.parse(pinned["time"].asString()))
        .withExtension(Events.CORRELATION_ID, "c0000000-0000-4000-8000-000000000001")
        .withData("application/json", Events.json.writeValueAsBytes(data))
        .build()

    fun stored(file: File): CloudEvent {
        val pinned = Events.json.readTree(file)
        return storedAs(pinned["type"].asString(), pinned, pinned["data"])
    }

    "every step the code knows starts from a type no longer written, and ends at one that is" {
        for (step in Upcasters.ALL.steps) {
            withClue(step.from) {
                (step.from in catalogued) shouldBe false
            }
        }
        val ends = Upcasters.ALL.steps.map { it.to }.filterNot { to -> Upcasters.ALL.steps.any { it.from == to } }
        for (end in ends) {
            withClue(end) { (end in catalogued) shouldBe true }
        }
    }

    "every retired type keeps the fixture it was stored as, and it still reads back as today's event" {
        val retired = Upcasters.ALL.steps.map { it.from }.toSet()
        val kept = File("../../contracts/fixtures/events/retired").listFiles().orEmpty()
            .filter { it.name.endsWith(".json") }.map { it.name.removeSuffix(".json") }.toSet()
        kept shouldBe retired
        for (type in retired) {
            val event = Events.converter().toDomainEvent(stored(File("../../contracts/fixtures/events/retired/$type.json")))
            withClue(type) { (EventTypes.rows[event::class] in catalogued) shouldBe true }
        }
    }

    // A founding as it might have been stored before `name` was called that: a v0, retired, and its step to v1.
    val founded = File("../../contracts/fixtures/events/villages.house.founded.v1.json")
    val renamed = Upcaster("villages.house.founded.v0", "villages.house.founded.v1") { data ->
        data.also { it.set("name", it.remove("houseName")) }
    }

    "an event stored as a retired type is read as today's, its envelope untouched" {
        val pinned = Events.json.readTree(founded)
        val old = (pinned["data"].deepCopy() as ObjectNode).also { it.set("houseName", it.remove("name")) }
        val written = storedAs("villages.house.founded.v0", pinned, old)

        val upcast = Upcasters(listOf(renamed)).upcast(written)
        upcast.type shouldBe "villages.house.founded.v1"
        upcast.id shouldBe written.id
        upcast.subject shouldBe written.subject
        upcast.time shouldBe written.time
        upcast.getExtension(Events.CORRELATION_ID) shouldBe written.getExtension(Events.CORRELATION_ID)

        val today = Events.converter().toDomainEvent(stored(founded))
        Events.converter(Upcasters(listOf(renamed))).toDomainEvent(written) shouldBe today
    }

    "steps chain, an event today's type passes through untouched, and a retired type nobody upcasts is refused by name" {
        val pinned = Events.json.readTree(founded)
        val older = Upcaster("villages.house.founded.vMinus1", "villages.house.founded.v0") { it }
        val chained = Upcasters(listOf(older, renamed))
        val oldest = (pinned["data"].deepCopy() as ObjectNode).also { it.set("houseName", it.remove("name")) }

        chained.upcast(storedAs("villages.house.founded.vMinus1", pinned, oldest)).type shouldBe "villages.house.founded.v1"
        chained.upcast(stored(founded)) shouldBe stored(founded)
        shouldThrow<IllegalArgumentException> { Events.converter().toDomainEvent(storedAs("villages.house.founded.v0", pinned, oldest)) }
            .message!! shouldContain "villages.house.founded.v0"
    }

    "two steps from one type, or steps that go round in a ring, are refused" {
        shouldThrow<IllegalArgumentException> { Upcasters(listOf(renamed, renamed)) }
        val ring = Upcasters(listOf(Upcaster("a.v1", "a.v2") { it }, Upcaster("a.v2", "a.v1") { it }))
        val pinned = Events.json.readTree(founded)
        shouldThrow<IllegalStateException> { ring.upcast(storedAs("a.v1", pinned, pinned["data"])) }
    }
})
