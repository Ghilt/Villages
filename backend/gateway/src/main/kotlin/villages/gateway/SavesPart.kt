package villages.gateway

import villages.application.Save
import villages.application.SaveRefused
import villages.application.WorldSaves
import villages.protocol.ErrorFrame
import villages.protocol.ListSaves
import villages.protocol.LoadSave
import villages.protocol.SaveView
import villages.protocol.SaveWorld
import villages.protocol.SavesListed
import villages.protocol.WorldWiped

/**
 * The world's saves, as the debug panel sees them through the gateway: the world saved under a name, the saves there
 * are, and one loaded in place of the world. A save and a listing are answered to the window that asked, with every save
 * there is, because neither changes anything anybody is looking at. A load changes everything: every session is ended
 * with `worldWiped`, as a wipe ends them, and each window arrives anew on the saved world. A refusal is `saveRefused`
 * with the reason. Instruments, refused `instrumentsClosed` where they are closed. See decision record 0101.
 */
internal class SavesPart(private val open: Boolean, private val core: Core, private val saves: WorldSaves) : Part {
    override fun register(commands: Commands, frames: Frames) {
        frames.on<SaveWorld> { connection, frame -> answer(connection, "saveWorld") { listed(saved(frame.name, connection)) } }
        frames.on<ListSaves> { connection, _ -> answer(connection, "listSaves") { listed(null) } }
        frames.on<LoadSave> { connection, frame -> answer(connection, "loadSave") { load(frame.name) } }
    }

    private fun saved(name: String, connection: Gateway.Connection): String = saves.save(name, connection.player).name

    private fun listed(saved: String?) = SavesListed(saves.saves().map(Save::toView), saved)

    /** Ends every session, the asker's too, so no window goes on showing the world the save replaced. */
    private fun load(name: String): Nothing? {
        val loaded = saves.load(name)
        core.endEverySession(WorldWiped("the world is the save ${loaded.name} now, ${loaded.events} events"))
        return null
    }

    private fun answer(connection: Gateway.Connection, frame: String, act: () -> SavesListed?) {
        val answer = if (!open) {
            ErrorFrame("instrumentsClosed", "$frame is one of the instruments, and they are closed here")
        } else {
            try {
                act()
            } catch (refused: SaveRefused) {
                ErrorFrame("saveRefused", refused.message ?: "refused")
            }
        }
        answer?.let(connection.out::send)
    }
}

private fun Save.toView() = SaveView(name, savedAt.toEpochMilli(), by?.value?.toString(), events, unreadable)
