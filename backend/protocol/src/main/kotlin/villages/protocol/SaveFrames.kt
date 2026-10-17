package villages.protocol

/*
 * How the debug panel saves the development world under a name, and hears which saves there are. Instruments, like
 * `wipeWorld`: a player's interface never sends them, and a server with its instruments closed refuses them. A save
 * refused is an `error` of code `saveRefused`, its message saying why. See decision record 0101.
 */

/** Saves every event of this tree's world under [name], beside every tree, so any of them can be given it again. */
data class SaveWorld(val name: String) : ClientFrame

/** One save: its name, when it was made in epoch milliseconds, the player who made it if any, and its events. */
data class SaveView(val name: String, val savedAt: Long, val by: String?, val events: Int)

/** Every save there is, newest first; [saved] is the one this answers the making of, null when it only lists. */
data class SavesListed(val saves: List<SaveView>, val saved: String? = null) : ServerFrame
