package villages.protocol

/*
 * How the debug panel saves the development world under a name, hears which saves there are, and loads one. Instruments,
 * like `wipeWorld`: a player's interface never sends them, and a server with its instruments closed refuses them. A save
 * or a load refused is an `error` of code `saveRefused`, its message saying why; a load done ends every session with
 * `worldWiped`, as a wipe does, and each window arrives anew. See decision record 0101.
 */

/** Saves every event of this tree's world under [name], beside every tree, so any of them can be given it again. */
data class SaveWorld(val name: String) : ClientFrame

/** Asks which saves there are: answered by `savesListed`. */
class ListSaves : ClientFrame {
    override fun equals(other: Any?): Boolean = other is ListSaves

    override fun hashCode(): Int = javaClass.hashCode()

    override fun toString(): String = "ListSaves"
}

/** Gives this tree's world the save called [name], in place of everything it holds, for everybody connected to it. */
data class LoadSave(val name: String) : ClientFrame

/**
 * One save: its name, when it was made in epoch milliseconds, the player who made it if any, and its events;
 * [unreadable] the first of them this code cannot read, in a line, or null when it can read them all.
 */
data class SaveView(val name: String, val savedAt: Long, val by: String?, val events: Int, val unreadable: String?)

/** Every save there is, newest first; [saved] is the one this answers the making of, null when it only lists. */
data class SavesListed(val saves: List<SaveView>, val saved: String? = null) : ServerFrame
