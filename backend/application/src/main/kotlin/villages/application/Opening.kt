package villages.application

import villages.application.bots.HouseBots

/**
 * The opening: what the game server does when a world begins - as it starts, after a wipe and after a load. It
 * records the catalogues the world is made of (0097), then makes every house bot the world lacks and has each one
 * found its house (0108). What is there already it leaves alone, so opening a world twice changes nothing. Without
 * [houseBots], which the tests that start a server leave out, it only records the catalogues.
 */
class Opening(private val recordCatalogues: () -> Unit, private val houseBots: HouseBots?) {
    /** Opens the world; says how many house bots it asked for. */
    fun open(): Int {
        recordCatalogues()
        return houseBots?.open() ?: 0
    }
}
