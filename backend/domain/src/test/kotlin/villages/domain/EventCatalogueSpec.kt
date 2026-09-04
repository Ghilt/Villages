package villages.domain

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import java.io.File
import kotlin.reflect.full.primaryConstructor

/**
 * The code and docs/EVENTS.md must agree, in both directions. Every HouseEvent has a row whose type is
 * `villages.house.<event>.v<n>` and whose payload lists exactly the event's fields; every row has an event.
 * The CloudEvent type mapping proper arrives with the event store in 1.5 and is tested there; this holds
 * the catalogue honest from the day the first event exists.
 */
class EventCatalogueSpec : StringSpec({
    val catalogue = File("../../docs/EVENTS.md").readText()
    val houseTable = catalogue.substringAfter("## House").substringBefore("\n## ", catalogue.substringAfter("## House"))
    val rows = Regex("""^\|\s*`(villages\.house\.[a-z]+\.v\d+)`\s*\|\s*([^|]*)\|""", RegexOption.MULTILINE)
        .findAll(houseTable)
        .map { it.groupValues[1] to it.groupValues[2] }
        .toList()

    /** `HouseFounded` is catalogued as `founded`: the aggregate is the prefix and the verb is the rest. */
    fun catalogueNameOf(event: Class<out HouseEvent>): String = event.simpleName.removePrefix("House").lowercase()

    "every event in the code has a row in the catalogue" {
        val inCode = HouseEvent::class.sealedSubclasses.map { catalogueNameOf(it.java) }.sorted()
        val inCatalogue = rows.map { (type, _) -> type.split('.')[2] }.distinct().sorted()

        inCatalogue shouldContainExactly inCode
    }

    "every row's payload lists exactly the event's fields, in the order they are declared" {
        for (event in HouseEvent::class.sealedSubclasses) {
            val fields = event.primaryConstructor!!.parameters.map { it.name!! }
            val row = rows.singleOrNull { (type, _) -> type.split('.')[2] == catalogueNameOf(event.java) }
            row shouldBe (row ?: error("no row for ${event.simpleName}"))
            val listed = Regex("`([a-zA-Z]+)`").findAll(row.second).map { it.groupValues[1] }.toList()

            listed shouldContainExactly fields
        }
    }
})
