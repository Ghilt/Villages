package villages.application

/**
 * The stands one layer of a master's sprite map says its ground has, for one zoom 7 tile, `x` across and `y` down:
 * the layer's own records, eight bytes a stand, as the tool that made it wrote them - the scenery's, `biome`, or the
 * ruined towns of 1790, `ruins`. Null when the master has no such layer, which is also what a name the folder does
 * not hold gets; empty where nothing stands in the tile. The gateway sends of them only what a house's fog lets
 * through. See decision records 0054, 0067 and 0101.
 */
fun interface Stands {
    fun of(master: String, layer: String, x: Int, y: Int): ByteArray?

    /** The scenery's own layer, `biome`. */
    fun of(master: String, x: Int, y: Int): ByteArray? = of(master, "biome", x, y)
}
