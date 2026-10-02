package villages.protocol

import com.fasterxml.jackson.annotation.JsonSubTypes
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import tools.jackson.databind.JsonNode
import java.io.File

/**
 * The fixtures own the wire format. Every fixture under contracts/fixtures/frames decodes, encodes again to
 * the same structure, and names a frame that exists; every frame that exists has at least one fixture. The
 * TypeScript package runs the same check on the same files, so neither side can drift from the other
 * without a test saying so.
 */
class FramesContractSpec : StringSpec({
    // Gradle runs tests from the module directory; the repository root is two above it.
    val fixtures = File("../../contracts/fixtures/frames")
    val clientFixtures = File(fixtures, "client").listFiles { file -> file.extension == "json" }!!.sortedBy { it.name }
    val serverFixtures = File(fixtures, "server").listFiles { file -> file.extension == "json" }!!.sortedBy { it.name }

    fun namesDeclaredOn(frame: Class<*>): List<String> =
        frame.getAnnotation(JsonSubTypes::class.java).value.map { it.name }

    "every client fixture decodes to a client frame and encodes back to the same structure" {
        clientFixtures.isNotEmpty() shouldBe true
        for (fixture in clientFixtures) {
            val text = fixture.readText()
            val frame = ProtocolJson.decodeClient(text)
            withClue(fixture.name) { shapeOf(ProtocolJson.encode(frame)) shouldBe shapeOf(text) }
        }
    }

    "every server fixture decodes to a server frame and encodes back to the same structure" {
        serverFixtures.isNotEmpty() shouldBe true
        for (fixture in serverFixtures) {
            val text = fixture.readText()
            val frame = ProtocolJson.decodeServer(text)
            withClue(fixture.name) { shapeOf(ProtocolJson.encode(frame)) shouldBe shapeOf(text) }
        }
    }

    "every frame that exists has a fixture, and every fixture names a frame that exists" {
        val typeOf = { file: File -> ProtocolJson.tree(file.readText()).get("type").asString() }

        clientFixtures.map(typeOf).distinct() shouldContainExactlyInAnyOrder namesDeclaredOn(ClientFrame::class.java)
        serverFixtures.map(typeOf).distinct() shouldContainExactlyInAnyOrder namesDeclaredOn(ServerFrame::class.java)
    }

    "the batch fixture carries every kind of delta, so a new delta needs a fixture too" {
        val batch = ProtocolJson.decodeServer(File(fixtures, "server/batch.json").readText()) as Batch
        val kinds = batch.deltas.map { it::class.simpleName!!.replaceFirstChar(Char::lowercase) }.distinct()

        kinds shouldContainExactlyInAnyOrder namesDeclaredOn(Delta::class.java)
    }

    "the choice fixtures carry every kind of effect between them, so a new effect needs a fixture too" {
        val choices = serverFixtures.filter { it.name.startsWith("yourChoice") }
            .mapNotNull { (ProtocolJson.decodeServer(it.readText()) as YourChoice).choice }
        val kinds = choices.flatMap { it.options }
            .map { it.effect::class.simpleName!!.removeSuffix("View").replaceFirstChar(Char::lowercase) }
            .distinct()

        kinds shouldContainExactlyInAnyOrder namesDeclaredOn(EffectView::class.java)
    }

    "the dialogue fixtures show every kind of reveal impact on an option between them, so a new kind needs one too" {
        val dialogues = serverFixtures.filter { it.name.startsWith("yourDialogues") }
            .flatMap { (ProtocolJson.decodeServer(it.readText()) as YourDialogues).dialogues }
        val kinds = dialogues.flatMap { it.options }.mapNotNull { it.revealImpact }
            .map { it::class.simpleName!!.replaceFirstChar(Char::lowercase) }
            .distinct()

        kinds shouldContainExactlyInAnyOrder namesDeclaredOn(RevealImpactView::class.java)
    }

    "the dialogue fixtures show every kind of thing a line can show between them, so a new kind needs one too" {
        val dialogues = serverFixtures.filter { it.name.startsWith("yourDialogues") }
            .flatMap { (ProtocolJson.decodeServer(it.readText()) as YourDialogues).dialogues }
        val kinds = dialogues.flatMap { it.next + it.options }.mapNotNull { it.shows }
            .map { it::class.simpleName!!.replaceFirstChar(Char::lowercase) }
            .distinct()

        kinds shouldContainExactlyInAnyOrder namesDeclaredOn(ShowsView::class.java)
    }
})

/**
 * The structure of some JSON with every number as a double, so that the fixture's `1` and Kotlin's `1.0` are
 * the same thing, which on the wire they are. Jackson's own node equality tells an integer node from a
 * floating one, and that is not a difference either side of this protocol can see.
 */
private fun shapeOf(json: String): Any? = shape(ProtocolJson.tree(json))

private fun shape(node: JsonNode): Any? = when {
    node.isNull -> null
    node.isNumber -> node.asDouble()
    node.isBoolean -> node.asBoolean()
    node.isTextual -> node.asString()
    // By index: Jackson 3 gives JsonNode a map(Function) of its own that applies to the node itself, so
    // Kotlin's Iterable.map is shadowed and node.map(::shape) is shape(node), forever.
    node.isArray -> (0 until node.size()).map { shape(node.get(it)) }
    node.isObject -> node.properties().associate { (name, value) -> name to shape(value) }
    else -> node.toString()
}

private inline fun <T> withClue(clue: String, block: () -> T): T =
    try {
        block()
    } catch (failure: AssertionError) {
        throw AssertionError("$clue: ${failure.message}", failure)
    }
