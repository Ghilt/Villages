package villages.protocol

import com.fasterxml.jackson.annotation.JsonSubTypes
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import java.io.File
import kotlin.reflect.KClass
import kotlin.reflect.KType
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
 * Names and fields, not types, and every field however deep: a frame's own, and those of every object
 * reached from them, by its path - `.dialogues[].lines[].revealImpact:shown`. What a field holds is the
 * fixtures' business, and they own the format. This one owns what exists at all, which is the half a stale
 * server gets wrong; a field added three objects down is that half too, and the recording used to stop at
 * the frame, so a change there moved nothing here and was numbered only when somebody remembered.
 */
class ProtocolShapeSpec : StringSpec({

    "the wire is the shape recorded for the version it declares" {
        if (System.getProperty("protocol.record") == "true") {
            withClue(
                """
                contracts/protocol-v$PROTOCOL_VERSION.txt is recorded already, and a version that has been spoken is
                never recorded over: a server and a page would come to disagree while both believe they agree.
                Raise PROTOCOL_VERSION at both ends and record again. If this version was never committed, delete
                its file and record again.
                """.trimIndent(),
            ) {
                recording.exists() shouldBe false
            }
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
        val names = shape().map { it.split(' ') }
            .filter { words -> words.size < 3 || !words[2].startsWith(".") }
            .map { words -> words[0] + " " + words[1] }

        names.size - names.distinct().size shouldBe 0
    }
})

private val recording = File("../../contracts/protocol-v$PROTOCOL_VERSION.txt")

/** The wire name of each leaf, taken from the annotation that puts it there. */
private fun namesOn(parent: KClass<*>): Map<String, String> =
    (parent.java.getAnnotation(JsonSubTypes::class.java)?.value ?: emptyArray())
        .associate { it.value.qualifiedName.orEmpty() to it.name }

/** What a class carries on the wire: its constructor's parameters, which are its JSON fields. */
private fun fieldsOf(type: KClass<*>): List<Pair<String, KType>> =
    type.primaryConstructor?.parameters.orEmpty().mapNotNull { parameter -> parameter.name?.let { it to parameter.type } }

private fun linesOf(side: String, parent: KClass<*>): List<String> {
    val named = namesOn(parent)
    return parent.sealedSubclasses.flatMap { leaf ->
        val name = named[leaf.qualifiedName]
            ?: error("${leaf.simpleName} is a ${parent.simpleName} that no @JsonSubTypes names")
        val fields = fieldsOf(leaf)
        listOf((listOf(side, name) + fields.map { it.first }.sorted()).joinToString(" ")) +
            fields.flatMap { (field, type) -> nested(side, name, ".$field", type, setOf(leaf)) }
    }
}

/**
 * The objects a field holds, however deep, each as a line of its path and its fields. Through a list, a map's
 * values and a nullable alike; into the protocol's own classes, and into each case of one that is a union; and
 * no further than a value, an enum, or the stored event's data, which the fixtures own.
 */
private fun nested(side: String, frame: String, path: String, type: KType, seen: Set<KClass<*>>): List<String> {
    val held = type.classifier as? KClass<*> ?: return emptyList()
    return when {
        held == List::class -> type.arguments.first().type?.let { nested(side, frame, "$path[]", it, seen) }.orEmpty()
        held == Map::class -> type.arguments[1].type?.let { nested(side, frame, "$path{}", it, seen) }.orEmpty()
        held in seen || held.java.isEnum || held.qualifiedName?.startsWith("villages.protocol.") != true -> emptyList()
        held.isSealed -> {
            val named = namesOn(held)
            held.sealedSubclasses.flatMap { case ->
                val name = named[case.qualifiedName] ?: error("${case.simpleName} is a ${held.simpleName} that no @JsonSubTypes names")
                below(side, frame, "$path:$name", case, seen + held)
            }
        }
        else -> below(side, frame, path, held, seen)
    }
}

private fun below(side: String, frame: String, path: String, held: KClass<*>, seen: Set<KClass<*>>): List<String> {
    val fields = fieldsOf(held)
    return listOf((listOf(side, frame, path) + fields.map { it.first }.sorted()).joinToString(" ")) +
        fields.flatMap { (field, type) -> nested(side, frame, "$path.$field", type, seen + held) }
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
    appendLine("# The shape of the wire at version $PROTOCOL_VERSION: every frame that may cross it, and every field it")
    appendLine("# carries, however deep. Recorded rather than derived so that changing the wire is a deliberate act with")
    appendLine("# a version number on it. Both ends check themselves against this file, which is also what pins the")
    appendLine("# Kotlin constant and the TypeScript one to each other. See ADR 0037.")
    appendLine("#")
    appendLine("# <side> <name on the wire> <field>...          a frame's own fields, sorted; the discriminator is not one")
    appendLine("# <side> <name on the wire> <path> <field>...   an object a field holds, by its path: .field, [] a list's")
    appendLine("#                                              items, {} a map's values, :name one case of a union")
    appendLine()
    appendLine("version $PROTOCOL_VERSION")
    appendLine()
    shape().forEach(::appendLine)
}
