package villages.application

import villages.application.bots.HouseBots
import villages.application.settlements.Settlements

/**
 * The opening: what the game server does when a world begins - as it starts, after a wipe and after a load. It
 * records the catalogues the world is made of (0097), then makes every house bot the world lacks and has each one
 * found its house (0108), then raises a settlement on every site the world lacks (0114). What is there already it
 * leaves alone, so opening a world twice changes nothing. Without [houseBots] or [settlements], which the tests that
 * start a server leave out, it does without them.
 */
class Opening(
    private val recordCatalogues: () -> Unit,
    private val houseBots: HouseBots?,
    private val settlements: Settlements? = null,
) {
    /** What an opening did: how many house bots it asked for, and what it did about the settlements. */
    data class Opened(val bots: Int, val settlements: Settlements.Opened?)

    /** Opens the world, and says what it did. */
    fun open(): Opened {
        recordCatalogues()
        val bots = houseBots?.open() ?: 0
        return Opened(bots, settlements?.open())
    }
}
