package villages.occurrent

import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import com.fasterxml.jackson.annotation.JsonSubTypes
import io.kotest.matchers.collections.shouldContainAll
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldMatch
import tools.jackson.databind.JsonNode
import villages.domain.Content
import villages.domain.Effect
import villages.domain.Requirement
import villages.domain.RevealImpact
import villages.domain.Shows
import villages.domain.Then
import java.io.File
import java.time.Instant
import kotlin.reflect.KClass

/**
 * The stored form of an event is a contract with every future version of the code, so it is pinned to
 * a fixture: contracts/fixtures/events holds one CloudEvent per catalogued type, exactly as stored. A field
 * renamed, a value class boxed, an instant written as a number, would all show here first.
 *
 * Every catalogued type is checked, not only the first one: a type with no fixture is a shape nobody
 * agreed to, and the first case below is what makes forgetting one impossible.
 */
class EventFormatSpec : StringSpec({
    val converter = Events.converter()
    val samples = EventSamples.samples
    val whereToSettle = EventSamples.whereToSettle
    val aLetter = EventSamples.aLetter

    fun fixture(type: String): JsonNode =
        Events.json.readTree(File("../../contracts/fixtures/events/$type.json"))

    /** Another case of a sealed field than a type's sample writes, pinned in a folder of its own. */
    fun case(name: String): JsonNode =
        Events.json.readTree(File("../../contracts/fixtures/events/cases/$name.json"))

    "every catalogued type has a sample here, so none of them goes unpinned" {
        samples.keys shouldContainExactlyInAnyOrder EventTypes.rows.values.toSet()
    }

    "each event is stored exactly as its fixture says" {
        for ((type, event) in samples) {
            val pinned = fixture(type)
            val stored = converter.toCloudEvent(event)

            withClue(type) {
                stored.type shouldBe pinned["type"].asString()
                stored.source.toString() shouldBe pinned["source"].asString()
                stored.subject shouldBe pinned["subject"].asString()
                stored.time!!.toInstant() shouldBe Instant.parse(pinned["time"].asString())
                stored.id shouldMatch Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
                Events.json.readTree(stored.data!!.toBytes()) shouldBe pinned["data"]
            }
        }
    }

    "and comes back as the same event" {
        for ((type, event) in samples) {
            withClue(type) {
                converter.toDomainEvent(converter.toCloudEvent(event)) shouldBe event
            }
        }
    }

    "the fixtures themselves read back as the events, so the files are the contract and not the code" {
        for ((type, event) in samples) {
            val bytes = Events.json.writeValueAsBytes(fixture(type)["data"])

            withClue(type) {
                Events.json.readValue(bytes, event.javaClass) shouldBe event
            }
        }
    }

    "and every other case of a sealed field is stored as its own fixture says, and reads back" {
        for ((name, event) in EventSamples.cases) {
            val pinned = case(name)
            val stored = converter.toCloudEvent(event)

            withClue(name) {
                stored.type shouldBe pinned["type"].asString()
                Events.json.readTree(stored.data!!.toBytes()) shouldBe pinned["data"]
                Events.json.readValue(Events.json.writeValueAsBytes(pinned["data"]), event.javaClass) shouldBe event
            }
        }
    }

    "a sealed field says which case it holds, so a reader never has to guess" {
        val written = Events.json.readTree(converter.toCloudEvent(whereToSettle).data!!.toBytes())

        written["choice"]["options"][0]["effect"][KIND].asString() shouldBe FOUND_AT

        val dialogue = Events.json.readTree(converter.toCloudEvent(aLetter).data!!.toBytes())["dialogue"]
        val lines = dialogue["lines"]
        lines[0]["then"][KIND].asString() shouldBe SAY
        lines[1]["then"][KIND].asString() shouldBe DIALOGUE_CHOICE
        lines[2]["effects"][0][KIND].asString() shouldBe SPEND
        lines[4]["effects"][0][KIND].asString() shouldBe GRANT
        lines[2]["revealImpact"][KIND].asString() shouldBe SHOWN
        lines[3]["revealImpact"][KIND].asString() shouldBe HIDDEN
        lines[3]["then"][KIND].asString() shouldBe END
        lines[0]["shows"][KIND].asString() shouldBe PLACE
        lines[1]["shows"][KIND].asString() shouldBe HOUSE
        lines[4]["shows"][KIND].asString() shouldBe CHARACTER
        dialogue["requirements"][0][KIND].asString() shouldBe ALIVE
    }

    /**
     * A case Jackson writes and cannot read back would make every later command on that house throw, because
     * every command reads the whole stream. So every case of every sealed field has a name in the store, and
     * some fixture writes each one. A new sealed field of an event is a new row in this map.
     */
    "every case of every sealed field has a name in the store, and a fixture that writes it" {
        val mixIns: Map<KClass<*>, KClass<*>> = mapOf(
            Effect::class to EffectJson::class,
            Then::class to ThenJson::class,
            Requirement::class to RequirementJson::class,
            RevealImpact::class to RevealImpactJson::class,
            Shows::class to ShowsJson::class,
            Content::class to ContentJson::class,
        )
        val named = mixIns.mapValues { (_, mixIn) -> mixIn.java.getAnnotation(JsonSubTypes::class.java).value.toList() }

        for ((sealed, types) in named) {
            withClue(sealed.simpleName) {
                types.map { it.value } shouldContainExactlyInAnyOrder sealed.sealedSubclasses
            }
        }
        (samples.keys.flatMap { kindsIn(fixture(it)) } + EventSamples.cases.keys.flatMap { kindsIn(case(it)) }).toSet() shouldContainAll
            named.values.flatten().map { it.name }
    }
})

/** Every `kind` written anywhere in a stored event, which is every case of a sealed field it holds. */
private fun kindsIn(node: JsonNode): List<String> =
    listOfNotNull(node.get(KIND)?.asString()) + node.flatMap(::kindsIn)
