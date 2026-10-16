package villages.app

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper

/**
 * Where two texts of a catalogue differ, as paths into the file: `types.castle.yields.naturalDomain`. Objects are
 * walked a field at a time, and anything else - a number, a word, a list - is one place, so a castle's yield changed
 * at one level is its whole yield, which is what a reader of the event list wants named. What `catalogueChanged`
 * carries as `changed`. A text that is not JSON differs everywhere. See decision record 0097.
 */
object CatalogueDiff {
    private val json = JsonMapper.builder().build()

    /** Past this many places a change is a rewrite, and the rest are counted rather than named. */
    private const val MOST = 40

    fun changes(before: String, after: String): List<String> {
        val was = runCatching { json.readTree(before) }.getOrNull()
        val now = runCatching { json.readTree(after) }.getOrNull()
        if (was == null || now == null) {
            return listOf(WHOLE)
        }
        val found = mutableListOf<String>()
        walk(was, now, "", found)
        return if (found.size <= MOST) found else found.take(MOST) + "and ${found.size - MOST} more"
    }

    private fun walk(was: JsonNode?, now: JsonNode?, at: String, found: MutableList<String>) {
        if (was == now) {
            return
        }
        if (was != null && now != null && was.isObject && now.isObject) {
            val fields = LinkedHashSet<String>().apply {
                was.properties().forEach { add(it.key) }
                now.properties().forEach { add(it.key) }
            }
            fields.forEach { field -> walk(was[field], now[field], if (at.isEmpty()) field else "$at.$field", found) }
        } else {
            found += at.ifEmpty { WHOLE }
        }
    }

    private const val WHOLE = "the whole file"
}
