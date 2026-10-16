package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import villages.application.CatalogueFiles
import villages.application.CatalogueReader
import villages.application.CatalogueRefused
import villages.application.Catalogues
import villages.application.Fault
import villages.application.Faults
import villages.application.Shelf
import villages.application.WorldCommandExecutor
import villages.domain.WorldTime
import villages.protocol.CatalogueRevised
import villages.protocol.CataloguesInForce
import villages.protocol.ErrorFrame
import villages.protocol.RevisionRefused
import villages.protocol.ServerFrame
import java.time.Instant

/**
 * The catalogues through the gateway: an inspect page, which says no hello, watching what the server runs on and
 * saving a catalogue through it, or refused with its reason. See decision record 0097.
 */
class GatewayCataloguesSpec : StringSpec({

    /** A shelf over a folder held in memory, whose reader refuses a catalogue that says it is broken. */
    fun shelfOver(files: MutableMap<String, String>): Shelf = Shelf(
        files = object : CatalogueFiles {
            override fun read(): Map<String, String> = files.toMap()

            override fun write(catalogue: String, text: String) {
                files[catalogue] = text
            }
        },
        reader = CatalogueReader { read ->
            if (read.values.any { "broken" in it }) throw CatalogueRefused("structures", "castle has no sightKm the server can read")
            Catalogues(RIG_CATALOGUE, RIG_BALANCE, RIG_FATE, RIG_NAMES)
        },
        world = WorldCommandExecutor { _, _ -> },
        clock = { Instant.parse("2026-10-16T12:00:00Z") },
        worldClock = { WorldTime(653_712) },
        faults = object : Faults {
            override fun report(fault: Fault) = Unit

            override fun watch(listener: (Fault) -> Unit) = AutoCloseable {}
        },
    ).apply { start() }

    /** An inspect page: connected, and no hello. */
    fun Rig.page(): Pair<Gateway.Connection, MutableList<ServerFrame>> {
        val sent = mutableListOf<ServerFrame>()
        return gateway.connect { sent += it } to sent
    }

    fun revising(text: String, basedOn: String) =
        """{"type":"reviseCatalogue","catalogue":"structures","text":"$text","basedOn":"$basedOn"}"""

    "a page that watches is told what the server runs on, and again when a revision of its is taken on" {
        val shelf = shelfOver(mutableMapOf("structures" to "castle\n"))
        val (page, sent) = Rig(catalogues = shelf).page()

        page.receive("""{"type":"watchCatalogues","on":true}""")
        page.receive(revising("fort", Shelf.fingerprintOf("castle\n")))

        sent shouldContainExactly listOf(
            CataloguesInForce(mapOf("structures" to Shelf.fingerprintOf("castle\n"))),
            CataloguesInForce(mapOf("structures" to Shelf.fingerprintOf("fort"))),
            CatalogueRevised("structures", Shelf.fingerprintOf("fort")),
        )
    }

    "a revision based on a file changed since, or one the server cannot read, is refused with its reason" {
        val files = mutableMapOf("structures" to "castle\n")
        val (page, sent) = Rig(catalogues = shelfOver(files)).page()

        page.receive(revising("fort", Shelf.fingerprintOf("mill\n")))
        page.receive(revising("broken", Shelf.fingerprintOf("castle\n")))

        sent.map { (it as RevisionRefused).code } shouldContainExactly listOf("stale", "unreadable")
        (sent.last() as RevisionRefused).reason shouldBe
            "world/catalogues/structures.json: castle has no sightKm the server can read"
        files["structures"] shouldBe "castle\n"
    }

    "closed, a page is refused both, and nothing is written" {
        val files = mutableMapOf("structures" to "castle\n")
        val (page, sent) = Rig(instrumentsOpen = false, catalogues = shelfOver(files)).page()

        page.receive("""{"type":"watchCatalogues","on":true}""")
        page.receive(revising("fort", Shelf.fingerprintOf("castle\n")))

        (sent[0] as ErrorFrame).code shouldBe "instrumentsClosed"
        (sent[1] as RevisionRefused).code shouldBe "instrumentsClosed"
        files["structures"] shouldBe "castle\n"
    }

    "a gateway with no shelf takes no revisions" {
        val (page, sent) = Rig().page()

        page.receive(revising("fort", ""))

        (sent.single() as RevisionRefused).code shouldBe "readOnly"
    }
})
