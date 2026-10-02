package villages.protocol

/**
 * The scenery's stands as they cross the wire: the sprite map's own records, eight bytes a stand, exactly as
 * `frontend/packages/world/src/stands.ts` writes and reads them, and what the gateway needs of one to ask the
 * fog about it. `contracts/fixtures/stands.json` holds both ends to the same records.
 *
 * A record belongs to one zoom 7 tile of the world, 256 world units a side, and says where its middle is from
 * the tile's north-west corner, little-endian, in eighths of a unit: two bytes across and two down, which may
 * run past the tile, because a stand is written into every tile it touches. Then its reach, in quarters of a
 * unit, and three bytes the page reads and the gateway never does. See decision record 0054.
 */
object StandRecords {
    /** How long one record is. */
    const val BYTES = 8

    /** How wide a zoom 7 tile is, in world units. */
    const val TILE_UNITS = 256

    /** How many world units the Mercator square is across: 128 tiles at zoom 7. */
    const val WORLD_UNITS = TILE_UNITS * 128

    private const val PLACE_STEP = 8.0
    private const val REACH_STEP = 4.0

    /** How many whole records there are. */
    fun count(records: ByteArray): Int = records.size / BYTES

    /** How far across the world the middle of record `at` is, in world units, for the tile `tileX` it is in. */
    fun x(records: ByteArray, at: Int, tileX: Int): Double =
        tileX * TILE_UNITS + int16(records, at * BYTES) / PLACE_STEP

    /** How far down the world the middle of record `at` is, in world units, for the tile `tileY` it is in. */
    fun y(records: ByteArray, at: Int, tileY: Int): Double =
        tileY * TILE_UNITS + int16(records, at * BYTES + 2) / PLACE_STEP

    /** How far record `at` reaches from its middle, in world units. */
    fun reach(records: ByteArray, at: Int): Double = (records[at * BYTES + 4].toInt() and BYTE) / REACH_STEP

    /** The records `keep` says yes to, in their order, byte for byte. */
    fun only(records: ByteArray, keep: (Int) -> Boolean): ByteArray {
        val kept = (0 until count(records)).filter(keep)
        val out = ByteArray(kept.size * BYTES)
        kept.forEachIndexed { to, from -> records.copyInto(out, to * BYTES, from * BYTES, from * BYTES + BYTES) }
        return out
    }

    private fun int16(bytes: ByteArray, offset: Int): Int =
        ((bytes[offset].toInt() and BYTE) or (bytes[offset + 1].toInt() shl Byte.SIZE_BITS)).toShort().toInt()

    private const val BYTE = 0xff
}
