package villages.protocol

import kotlin.math.ceil
import kotlin.math.floor

/** Held cells coarser than this are a quarter of a continent and more, and the scenery is never drawn so far out. */
const val STANDS_FROM_ZOOM = 6

/**
 * How far past a held cell its stands are looked for, in world units. The page holds a ring of cells round what
 * it shows and draws a ring of scatter cells round it too, each reading its stands a spacing and a wander past
 * its own edge, fourteen units at the widest: sixteen past every held cell reaches every tile any of them reads.
 */
const val STAND_TILE_MARGIN = 16.0

/** How many zoom 7 tiles the world is across, and down. */
const val STAND_TILES = StandRecords.WORLD_UNITS / StandRecords.TILE_UNITS

/**
 * The layers of the sprite map whose stands the gateway sends: the scenery's own, `biome`, the towns of 1790 laid in
 * ruins, `ruins`, a stand a town, and the roads, `roads`, a straight piece a record. A stands frame says which it
 * carries, and a layer is only ever one of these: a name from a page never picks a folder. See decision records 0067,
 * 0103 and 0115.
 */
val STAND_LAYERS = listOf("biome", "ruins", "roads", "settlements")

/**
 * The zoom 7 tiles whose stands a held cell wants, each as `y * STAND_TILES + x`: the tiles the cell lies in and
 * any its margin reaches into. None for a cell coarser than `STANDS_FROM_ZOOM`. Across wraps round the world, as
 * the sprite map does; down stops at the edges.
 *
 * Both ends work this out. The gateway sends a tile once while a held cell is over it and lets it go when none
 * is, and the page keeps a tile exactly as long, so it waits for the gateway's answer on coming back rather than
 * drawing from what it was told before. `contracts/fixtures/stand-tiles.json` holds the two to the same tiles.
 * See decision record 0067.
 */
fun standTilesUnder(quadkey: String): List<Int> {
    val cell = Cell(quadkey)
    if (cell.zoom < STANDS_FROM_ZOOM) {
        return emptyList()
    }
    val side = StandRecords.WORLD_UNITS.toDouble() / (1 shl cell.zoom)
    val tile = StandRecords.TILE_UNITS.toDouble()
    val firstX = floor((cell.column * side - STAND_TILE_MARGIN) / tile).toInt()
    val lastX = ceil(((cell.column + 1) * side + STAND_TILE_MARGIN) / tile).toInt() - 1
    val firstY = floor((cell.row * side - STAND_TILE_MARGIN) / tile).toInt().coerceAtLeast(0)
    val lastY = (ceil(((cell.row + 1) * side + STAND_TILE_MARGIN) / tile).toInt() - 1).coerceAtMost(STAND_TILES - 1)
    return buildList {
        for (y in firstY..lastY) {
            for (x in firstX..lastX) {
                add(y * STAND_TILES + Math.floorMod(x, STAND_TILES))
            }
        }
    }
}
