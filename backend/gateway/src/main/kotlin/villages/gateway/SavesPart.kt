package villages.gateway

import villages.application.Save
import villages.application.SaveRefused
import villages.application.WorldSaves
import villages.protocol.ErrorFrame
import villages.protocol.SaveView
import villages.protocol.SaveWorld
import villages.protocol.SavesListed

/**
 * The world's saves, as the debug panel sees them through the gateway: the world saved under a name, answered with
 * every save there is, or refused `saveRefused` with the reason. Instruments, refused `instrumentsClosed` on a server
 * whose instruments are closed. The save is answered to the window that asked, and to nobody else: a save changes
 * nothing anybody is looking at. See decision record 0101.
 */
internal class SavesPart(private val open: Boolean, private val saves: WorldSaves) : Part {
    override fun register(commands: Commands, frames: Frames) {
        frames.on<SaveWorld> { connection, frame -> save(connection, frame.name) }
    }

    private fun save(connection: Gateway.Connection, name: String) {
        val answer = when {
            !open -> ErrorFrame("instrumentsClosed", "saveWorld is one of the instruments, and they are closed here")
            else -> try {
                saves.save(name, connection.player)
                SavesListed(saves.saves().map(Save::toView), saved = name)
            } catch (refused: SaveRefused) {
                ErrorFrame("saveRefused", refused.message ?: "the save was refused")
            }
        }
        connection.out.send(answer)
    }
}

private fun Save.toView() = SaveView(name, savedAt.toEpochMilli(), by?.value?.toString(), events)
