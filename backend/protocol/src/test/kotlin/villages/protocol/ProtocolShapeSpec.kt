package villages.protocol

import com.fasterxml.jackson.annotation.JsonSubTypes
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import java.io.File
import kotlin.reflect.KClass
import kotlin.reflect.full.primaryConstructor

/**
 * The shape of the wire is written down, one file per version of it, and the recording for the version
 * this code declares is exactly what this code speaks.
 *
 * This exists because of what a stale server looks like from the browser. A gateway built before a frame
 * existed answers that frame with Jackson's own words, "could not resolve type id 'wipeWorld'", which
 * names everything except the fault: the server is older than the page talking to it. The handshake can
 * say that plainly, and already does - it refuses a version it cannot speak - but a version number nobody
 * remembers to change says nothing at all. So this test goes red the moment a frame or a field moves. The
 * way out is to bump PROTOCOL_VERSION at both ends and record the new shape beside the old ones, which
 * leaves contracts/protocol-v*.txt as the history of the wire.
 *
 * Names and fields, not types: what a field holds is the fixtures' business, and they own the format.
 * This one owns what exists at all, which is the half a stale server gets wrong.
 */
class ProtocolShapeSpec : StringSpec({

    "the wire is the shape recorded for the version it declares" {
        if (System.getProperty("protocol.record") == "true") {
            recording.writeText(render())
        }

        withClue("no recording of version $PROTOCOL_VERSION exists at ${recording.path}") {
            recording.exists() shouldBe true
        }

        withClue(
            """
            The wire is not what contracts/protocol-v$PROTOCOL_VERSION.txt records.

            If a frame or a field was meant to change, then the version must change with it:
              1. PROTOCOL_VERSION = ${PROTOCOL_VERSION + 1} in backend/protocol/.../Frames.kt
              2. PROTOCOL_VERSION = ${PROTOCOL_VERSION + 1} in frontend/packages/protocol/src/index.ts
              3. cd backend && ./gradlew :protocol:test -Dprotocol.record=true
            That writes contracts/protocol-v${PROTOCOL_VERSION + 1}.txt and leaves the older ones alone.
            Recording over a version that has already been spoken is not the way out; it is how a server
            and a page come to disagree while both believe they agree.
            """.trimIndent(),
        ) {
            meaningful(recording.readText()) shouldBe listOf("version $PROTOCOL_VERSION") + shape()
        }
    }

    "no two frames answer to the same name" {
        val names = shape().map { it.substringBefore(' ') + " " + it.split(' ')[1] }

        names.size - names.distinct().size shouldBe 0
    }
})

private val recording = File("../../contracts/protocol-v$PROTOCOL_VERSION.txt")

/** The wire name of each leaf, taken from the annotation that puts it there. */
private fun namesOn(parent: KClass<*>): Map<String, String> =
    (parent.java.getAnnotation(JsonSubTypes::class.java)?.value ?: emptyArray())
        .associate { it.value.qualifiedName.orEmpty() to it.name }

private fun linesOf(side: String, parent: KClass<*>): List<String> {
    val named = namesOn(parent)
    return parent.sealedSubclasses.map { leaf ->
        val name = named[leaf.qualifiedName]
            ?: error("${leaf.simpleName} is a ${parent.simpleName} that no @JsonSubTypes names")
        val fields = leaf.primaryConstructor?.parameters?.mapNotNull { it.name }?.sorted().orEmpty()
        (listOf(side, name) + fields).joinToString(" ")
    }
}

private fun shape(): List<String> = (
    linesOf("client", ClientFrame::class) +
        linesOf("command", CommandPayload::class) +
        linesOf("delta", Delta::class) +
        linesOf("effect", EffectView::class) +
        linesOf("server", ServerFrame::class)
    ).sorted()

/** What the file says, with its reasons and its blank lines taken out. */
private fun meaningful(text: String): List<String> =
    text.lines().map(String::trim).filter { it.isNotEmpty() && !it.startsWith("#") }

private fun render(): String = buildString {
    appendLine("# The shape of the wire at version $PROTOCOL_VERSION: every frame that may cross it, and the")
    appendLine("# fields it carries. Recorded rather than derived so that changing the wire is a deliberate")
    appendLine("# act with a version number on it. Both ends check themselves against this file, which is")
    appendLine("# also what pins the Kotlin constant and the TypeScript one to each other. See ADR 0037.")
    appendLine("#")
    appendLine("# <side> <name on the wire> <field>...   fields sorted; the discriminator is not a field.")
    appendLine()
    appendLine("version $PROTOCOL_VERSION")
    appendLine()
    shape().forEach(::appendLine)
}
