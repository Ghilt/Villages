package villages.application

/**
 * The stands of the scenery a master's sprite map says its ground has, for one zoom 7 tile, `x` across and `y`
 * down: the sprite map's own records, eight bytes a stand, as the generator wrote them. Null when there is no
 * sprite map for a master of that name, which is also what a name the folder does not hold gets; empty where
 * nothing stands in the tile. The gateway sends of them only what a house's fog lets through. See decision
 * records 0054 and 0067.
 */
fun interface Stands {
    fun of(master: String, x: Int, y: Int): ByteArray?
}
