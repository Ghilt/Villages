package villages.application

import villages.domain.PlayerId
import java.time.Instant

/**
 * The development world, saved under a name and kept beside every tree, so that any tree can be given it again. A
 * debug feature and one of Adam's instruments: nothing in the world records that it was saved, because a save is not
 * something that happened in it. A save is every stored event, as the store holds it. See decision record 0101.
 */
interface WorldSaves {
    /**
     * Saves every event of the world under [name], in one moment that no command crosses, so a save never holds half
     * of what was being written. [by] is the player who asked, whom a load hands the window back to. Refused, with
     * nothing written, for a name that is not one or is taken: see [SaveRefused].
     */
    fun save(name: String, by: PlayerId?): Save

    /** Every save there is, newest first. */
    fun saves(): List<Save>

    companion object {
        /** A server or a test told of nowhere to keep saves: it lists none, and refuses to make one. */
        val NOWHERE: WorldSaves = object : WorldSaves {
            override fun save(name: String, by: PlayerId?): Save = throw SaveRefused("this server keeps no saves")

            override fun saves(): List<Save> = emptyList()
        }
    }
}

/** One save: its [name], when it was made and by whom, and how many events it holds. */
data class Save(val name: String, val savedAt: Instant, val by: PlayerId?, val events: Int)

/** A save refused, and nothing written; the message says why, in words the panel shows. */
class SaveRefused(message: String) : RuntimeException(message)
