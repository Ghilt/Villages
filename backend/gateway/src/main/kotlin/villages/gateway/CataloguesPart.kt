package villages.gateway

import villages.application.CatalogueRefused
import villages.application.CatalogueStale
import villages.application.CataloguesReadOnly
import villages.application.Shelf
import villages.protocol.CatalogueRevised
import villages.protocol.CataloguesInForce
import villages.protocol.ErrorFrame
import villages.protocol.ReviseCatalogue
import villages.protocol.RevisionRefused
import villages.protocol.ServerFrame
import villages.protocol.WatchCatalogues
import java.util.concurrent.ConcurrentHashMap

/**
 * The catalogues, as the inspect pages see them through the gateway: what the game server runs on, sent to whoever
 * watches when they start and again whenever the shelf takes something on, and a revision saved and taken on, or
 * refused with its reason. Instruments, as the event page's watching is: no hello is asked, and a server with its
 * instruments closed refuses both. With no shelf, a gateway takes no revisions. See decision record 0097.
 */
internal class CataloguesPart(private val open: Boolean, private val shelf: Shelf?) : Part {
    private val watching = ConcurrentHashMap.newKeySet<Gateway.Connection>()

    private val told: AutoCloseable? = shelf?.watch { fingerprints ->
        val frame = CataloguesInForce(fingerprints)
        watching.forEach { it.out.send(frame) }
    }

    override fun register(commands: Commands, frames: Frames) {
        frames.on<WatchCatalogues> { connection, frame -> watch(connection, frame.on) }
        frames.on<ReviseCatalogue> { connection, frame -> connection.out.send(revised(frame)) }
    }

    private fun watch(connection: Gateway.Connection, on: Boolean) {
        if (!open) {
            connection.out.send(ErrorFrame("instrumentsClosed", "watchCatalogues is one of the instruments, and they are closed here"))
        } else if (on) {
            watching += connection
            connection.out.send(CataloguesInForce(shelf?.fingerprints().orEmpty()))
        } else {
            watching -= connection
        }
    }

    private fun revised(frame: ReviseCatalogue): ServerFrame {
        val refused = { code: String, reason: String? -> RevisionRefused(frame.catalogue, code, reason ?: code) }
        return when {
            !open -> refused("instrumentsClosed", "reviseCatalogue is one of the instruments, and they are closed here")
            shelf == null -> refused("readOnly", "this server takes no revisions of its catalogues")
            else -> try {
                CatalogueRevised(frame.catalogue, shelf.revise(frame.catalogue, frame.text, frame.basedOn))
            } catch (stale: CatalogueStale) {
                refused("stale", stale.message)
            } catch (unreadable: CatalogueRefused) {
                refused("unreadable", unreadable.message)
            } catch (closed: CataloguesReadOnly) {
                refused("readOnly", closed.message)
            }
        }
    }

    override fun ended(connection: Gateway.Connection) {
        watching -= connection
    }

    override fun close() {
        told?.close()
    }
}
