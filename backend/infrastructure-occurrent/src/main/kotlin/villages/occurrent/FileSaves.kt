package villages.occurrent

import io.cloudevents.CloudEvent
import io.cloudevents.core.builder.CloudEventBuilder
import tools.jackson.databind.node.ObjectNode
import villages.application.Save
import villages.application.SaveRefused
import villages.application.WorldSaves
import villages.domain.PlayerId
import java.net.URI
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.time.Clock
import java.time.Instant
import java.time.OffsetDateTime
import java.util.UUID
import kotlin.io.path.bufferedReader
import kotlin.io.path.bufferedWriter
import kotlin.io.path.exists
import kotlin.io.path.listDirectoryEntries
import kotlin.io.path.name

/**
 * Saves of [world], each a file in [folder]: `<name>.jsonl`, a line saying what the save is, then every stored event,
 * oldest first, one a line, its stream and its place in it among its extensions. The folder is every tree's, beside
 * the shared `.git`, so a save made in one tree is there in all of them. See decision record 0101.
 */
class FileSaves(private val folder: Path, private val world: EventWorld, private val clock: Clock) : WorldSaves {
    override fun save(name: String, by: PlayerId?): Save {
        if (!NAME.matches(name)) {
            throw SaveRefused("\"$name\" is not a save's name: lower-case letters, digits and single hyphens, at most $LONGEST")
        }
        val file = folder.resolve("$name$SUFFIX")
        if (file.exists()) throw SaveRefused("there is a save called $name already")

        val events = world.everyEvent()
        val save = Save(name, clock.instant(), by, events.size)
        Files.createDirectories(folder)
        // Written beside and moved into place, so a save half written is never listed.
        val writing = folder.resolve("$name$SUFFIX.part")
        writing.bufferedWriter().use { out ->
            out.line(headerOf(save))
            events.forEach { out.line(lineOf(it)) }
        }
        Files.move(writing, file, StandardCopyOption.ATOMIC_MOVE)
        return save
    }

    override fun saves(): List<Save> =
        if (!folder.exists()) {
            emptyList()
        } else {
            folder.listDirectoryEntries("*$SUFFIX").mapNotNull { file ->
                file.bufferedReader().use { it.readLine() }?.let { saveOf(it, file.name.removeSuffix(SUFFIX)) }
            }.sortedByDescending { it.savedAt }
        }

    private fun headerOf(save: Save): String {
        val header = Events.json.createObjectNode()
        header.put("save", save.name).put("savedAt", save.savedAt.toString()).put("events", save.events)
        save.by?.let { header.put("by", it.value.toString()) }
        return Events.json.writeValueAsString(header)
    }

    /** The first line of a save back into what it says; a file whose first line is not one is no save, and not listed. */
    @Suppress("TooGenericExceptionCaught", "SwallowedException")
    private fun saveOf(header: String, name: String): Save? = try {
        val kept = Events.json.readTree(header)
        Save(
            name = name,
            savedAt = Instant.parse(kept["savedAt"].asString()),
            by = kept["by"]?.let { PlayerId(UUID.fromString(it.asString())) },
            events = kept["events"].asInt(),
        )
    } catch (notASave: RuntimeException) {
        null
    }

    companion object {
        const val SUFFIX = ".jsonl"
        const val LONGEST = 60
        private val NAME = Regex("(?=.{1,$LONGEST}$)[a-z0-9]+(-[a-z0-9]+)*")

        /** One stored event as a line of a save: everything the store holds of it, the extensions included. */
        fun lineOf(event: CloudEvent): String {
            val line = Events.json.createObjectNode()
            line.put("id", event.id).put("type", event.type).put("source", event.source.toString())
            event.subject?.let { line.put("subject", it) }
            event.time?.let { line.put("time", it.toString()) }
            val extensions = line.putObject("extensions")
            event.extensionNames.sorted().forEach { name ->
                when (val value = event.getExtension(name)) {
                    is Number -> extensions.put(name, value.toLong())
                    null -> Unit
                    else -> extensions.put(name, value.toString())
                }
            }
            line.set("data", Events.json.readTree(event.data!!.toBytes()) as ObjectNode)
            return Events.json.writeValueAsString(line)
        }

        /** A line of a save back into the CloudEvent it was stored as. */
        fun eventOf(line: String): CloudEvent {
            val kept = Events.json.readTree(line)
            val built = CloudEventBuilder.v1()
                .withId(kept["id"].asString())
                .withType(kept["type"].asString())
                .withSource(URI.create(kept["source"].asString()))
                .withData("application/json", Events.json.writeValueAsBytes(kept["data"]))
            kept["subject"]?.let { built.withSubject(it.asString()) }
            kept["time"]?.let { built.withTime(OffsetDateTime.parse(it.asString())) }
            kept["extensions"]?.properties()?.forEach { (name, value) ->
                if (value.isNumber) built.withExtension(name, value.asLong()) else built.withExtension(name, value.asString())
            }
            return built.build()
        }
    }
}

/** One line, ended by one line feed on every machine, so a save is the same file wherever it was made. */
private fun java.io.Writer.line(text: String) {
    write(text)
    write(LINE_FEED)
}

private const val LINE_FEED = 10
