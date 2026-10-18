package villages.gateway

import villages.application.Stands
import villages.domain.PlayerId
import villages.protocol.Hello
import villages.protocol.STAND_LAYERS
import villages.protocol.STAND_TILES
import villages.protocol.StandRecords
import villages.protocol.StandsFrame
import villages.protocol.standTilesUnder
import java.util.Base64

/**
 * The stands of the sprite map's layers - the scenery's and the ruined towns' - a page is sent tile by tile under the
 * cells it holds, every layer of a tile, for the world it draws, which hello names, and only where they touch ground
 * its house has revealed. A tile's layer is sent once while it is held, empty where the world has no such layer so
 * the page knows it has all there is, and again only when what the fog lets through of it changes. See decision
 * records 0061, 0067, 0075 and 0103.
 */
internal class StandsPart(private val stands: Stands) : Part {
    /** What one connection draws, and what it has been sent of it. */
    private class Sent {
        /** The world the page draws, from hello. Null, and it is sent no stands. */
        @Volatile
        var master: String? = null

        /** The tiles a held cell is over, as `y * STAND_TILES + x`, with what was last sent of each, a layer at a time. */
        val tiles = HashMap<Int, Array<ByteArray?>>()
    }

    private fun sentTo(connection: Gateway.Connection): Sent = connection.keptBy(this) { Sent() }

    override fun arrive(connection: Gateway.Connection, hello: Hello, who: PlayerId) {
        sentTo(connection).master = hello.master
    }

    override fun cellsTaken(connection: Gateway.Connection, cells: List<String>) {
        val sent = sentTo(connection)
        if (sent.master == null) {
            return
        }
        val tiles = synchronized(sent) { cells.flatMap(::standTilesUnder).distinct().filter { it !in sent.tiles } }
        offer(connection, sent, tiles, again = false)
    }

    /** A tile no held cell is over any more is let go, so coming back to it sends it afresh. */
    override fun cellsLetGo(connection: Gateway.Connection, still: Set<String>) {
        val sent = sentTo(connection)
        synchronized(sent) { sent.tiles.keys.retainAll(still.flatMap(::standTilesUnder).toSet()) }
    }

    /** Every held tile answered again when what the fog lets through has changed. Only what changed goes. */
    override fun lookingChanged(connection: Gateway.Connection, was: Looking, now: Looking) {
        if (now.fogsOtherwiseThan(was)) {
            val sent = sentTo(connection)
            offer(connection, sent, synchronized(sent) { sent.tiles.keys.toList() }, again = true)
        }
    }

    override fun ended(connection: Gateway.Connection) {
        val sent = sentTo(connection)
        synchronized(sent) { sent.tiles.clear() }
    }

    /**
     * Sends each tile's stands as far as the fog lets them through: a tile newly under a held cell whatever
     * it holds, empty or not, so the page knows it has all there is; a tile already held only if that has
     * changed. What the fog holds back is left out, and nothing says how much was.
     */
    private fun offer(connection: Gateway.Connection, sent: Sent, tiles: Collection<Int>, again: Boolean) {
        val looking = connection.looking
        for (tile in tiles) {
            val x = tile % STAND_TILES
            val y = tile / STAND_TILES
            for ((at, layer) in STAND_LAYERS.withIndex()) {
                val through = standsOf(sent.master, layer, looking, x, y)
                val send = synchronized(sent) {
                    val held = sent.tiles[tile]
                    val was = held?.get(at)
                    if ((again && was == null) || (was != null && was.contentEquals(through))) {
                        false
                    } else {
                        sent.tiles.getOrPut(tile) { arrayOfNulls(STAND_LAYERS.size) }[at] = through
                        true
                    }
                }
                if (send) {
                    connection.out.send(StandsFrame(x, y, Base64.getEncoder().encodeToString(through), layer))
                }
            }
        }
    }

    /** The stands of one layer of one tile of a world that a way of looking lets through. A world with none has none. */
    private fun standsOf(master: String?, layer: String, looking: Looking, x: Int, y: Int): ByteArray {
        val all = master?.let { stands.of(it, layer, x, y) } ?: return ByteArray(0)
        if (!looking.fogged) {
            return all
        }
        val seeing = looking.fog
        return StandRecords.only(all) { at ->
            seeing.letsThrough(StandRecords.x(all, at, x), StandRecords.y(all, at, y), StandRecords.reach(all, at))
        }
    }
}
