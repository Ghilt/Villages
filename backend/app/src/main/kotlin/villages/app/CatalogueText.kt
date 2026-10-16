package villages.app

import tools.jackson.core.JsonGenerator
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.io.StringWriter

/**
 * A catalogue's one form, which the game server writes every revision in: two spaces; a list or an object of plain
 * values on one line however long, `{ "european": "castle", ... }` and `[3, 5, 8]`; one holding others, or carrying a
 * `$comment`, which makes it a section, on one line wherever it fits in [WIDTH] columns with what follows it, and on
 * lines of its own where it does not; the fields in the order they came, and a line feed at the end. What `world/catalogues/` is
 * written in by hand, so a number saved from an inspect page is a diff of one line. See decision record 0097.
 */
object CatalogueText {
    const val WIDTH = 120

    /** What says what a section is: an object carrying it opens out like one holding others. */
    private const val COMMENT = "\$comment"

    private val json = JsonMapper.builder().build()

    /** [text] in the one form; throws for text that is not JSON. */
    fun format(text: String): String = written(json.readTree(text), indent = 0, before = 0, after = 0) + "\n"

    /** [node] at [indent], with [before] columns of its line already taken and [after] to follow it on the line. */
    private fun written(node: JsonNode, indent: Int, before: Int, after: Int): String {
        val flat = flat(node)
        val plain = node.isContainer && children(node).none { it.isContainer } && !node.has(COMMENT)
        if (!node.isContainer || node.isEmpty || plain || indent + before + flat.length + after <= WIDTH) {
            return flat
        }
        val inner = " ".repeat(indent + 2)
        val lines = if (node.isObject) {
            val fields = node.properties().toList()
            fields.mapIndexed { at, (name, value) ->
                val key = "${scalar(json.nodeFactory.stringNode(name))}: "
                val comma = if (at < fields.size - 1) 1 else 0
                inner + key + written(value, indent + 2, key.length, comma)
            }
        } else {
            val values = node.values().toList()
            values.mapIndexed { at, value -> inner + written(value, indent + 2, 0, if (at < values.size - 1) 1 else 0) }
        }
        val (open, close) = if (node.isObject) "{" to "}" else "[" to "]"
        return lines.joinToString(",\n", prefix = "$open\n", postfix = "\n${" ".repeat(indent)}$close")
    }

    private fun children(node: JsonNode): List<JsonNode> =
        if (node.isObject) node.properties().map { it.value } else node.values().toList()

    /** [node] on one line: `{ "a": 1, "b": [1, 2] }`, `[{ "a": 1 }]`, `{}`. */
    private fun flat(node: JsonNode): String = when {
        node.isObject && node.isEmpty -> "{}"
        node.isObject -> node.properties().joinToString(", ", prefix = "{ ", postfix = " }") { (name, value) ->
            "${scalar(json.nodeFactory.stringNode(name))}: ${flat(value)}"
        }
        node.isArray -> node.values().joinToString(", ", prefix = "[", postfix = "]") { flat(it) }
        else -> scalar(node)
    }

    /** A number, a word, true, false or null, as JSON writes it. */
    private fun scalar(node: JsonNode): String {
        val out = StringWriter()
        json.createGenerator(out).use { generator: JsonGenerator -> json.writeTree(generator, node) }
        return out.toString()
    }
}
